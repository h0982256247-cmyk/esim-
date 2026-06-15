import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAuth } from '@/lib/auth/platform'
import { prisma } from '@/lib/db/prisma'
import { safeDecrypt } from '@/lib/utils/crypto'
import { retryEsimActivation } from '@/lib/services/esim'
import { cancelCommission } from '@/lib/services/commission'
import { restoreCouponsForRefundedOrder } from '@/lib/services/coupon'
import { tapPayRefund } from '@/lib/services/tappay'
import { OrderStatus } from '@prisma/client'

// 退款可生效的狀態（已實際扣款者）
const REFUNDABLE_STATUSES: OrderStatus[] = [
  OrderStatus.PAID,
  OrderStatus.COMPLETED,
  OrderStatus.ESIM_PENDING,
]

type Params = { params: Promise<{ id: string }> }

// GET /api/platform/orders/:id
export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requirePlatformAuth(req)
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  // 租戶隔離：非 SUPER_ADMIN（tenantAdminId 為 null 才是平台級）只能存取自己租戶的訂單，
  // 否則可用訂單 id 直接讀其他租戶客戶的 PII。
  const tenantWhere = auth.tenantAdminId ? { user: { tenantAdminId: auth.tenantAdminId } } : {}
  const order = await prisma.order.findFirst({
    where: { id, ...tenantWhere },
    include: {
      user: { select: { displayName: true, lineUid: true, phone: true, email: true } },
      orderItems: true,
      orderCoupons: { include: { coupon: { select: { type: true, discount: true } } } },
      commission: true,
    },
  })

  if (!order) return NextResponse.json({ error: '訂單不存在' }, { status: 404 })

  // 同捆訂單（多張 eSIM 一次購買 = 共用 bundleId 的多筆訂單）：列出其他張供切換查看。
  const siblings = order.bundleId
    ? await prisma.order.findMany({
        where: { bundleId: order.bundleId, id: { not: order.id }, ...tenantWhere },
        select: {
          id: true, orderNumber: true, status: true,
          orderItems: { select: { productName: true }, take: 1 },
        },
        orderBy: { createdAt: 'asc' },
      })
    : []

  // 客戶聯絡資訊在 DB 加密；後台撥款/客服需要看明文，解密後回傳（safeDecrypt 相容舊明文）。
  return NextResponse.json({
    order: {
      ...order,
      user: {
        ...order.user,
        phone: order.user.phone ? safeDecrypt(order.user.phone) : null,
        email: order.user.email ? safeDecrypt(order.user.email) : null,
      },
    },
    siblings,
  })
}

// PATCH /api/platform/orders/:id  — action: retry_esim | refund
export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requirePlatformAuth(req)
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const { action } = await req.json()

  // 租戶隔離：非 SUPER_ADMIN 只能操作自己租戶的訂單（補發 / 退款都會動到金流與供應商）。
  const tenantWhere = auth.tenantAdminId ? { user: { tenantAdminId: auth.tenantAdminId } } : {}

  if (action === 'retry_esim') {
    const order = await prisma.order.findFirst({ where: { id, ...tenantWhere }, select: { status: true } })
    if (!order) return NextResponse.json({ error: '訂單不存在' }, { status: 404 })
    // 補發對象：付款成功但尚未發卡（PAID；含下單失敗的訂單，已不再轉 ESIM_PENDING）。
    // ESIM_PENDING 保留以相容歷史訂單。COMPLETED 已發卡、其餘狀態未付款，皆不可補發。
    // retryEsimActivation 內部具冪等守門（wmOrderId 已存在則略過），重複觸發安全。
    if (order.status !== OrderStatus.PAID && order.status !== OrderStatus.ESIM_PENDING) {
      return NextResponse.json({ error: '只有「付款成功但尚未發卡」的訂單可補發' }, { status: 409 })
    }
    retryEsimActivation(id).catch(() => {})
    return NextResponse.json({ ok: true, message: '已觸發補發流程' })
  }

  if (action === 'refund') {
    // 1. 撈訂單資料 + tappayRecTradeId（退款必須）
    const order = await prisma.order.findFirst({
      where: { id, ...tenantWhere },
      select: {
        status: true,
        totalPaid: true,
        tapPayRecTradeId: true,
        user: { select: { tenantAdminId: true } },
        gift: { select: { id: true, claimedAt: true, cancelledAt: true, toUser: { select: { displayName: true } } } },
      },
    })
    if (!order) return NextResponse.json({ error: '訂單不存在' }, { status: 404 })
    if (order.status === OrderStatus.REFUNDED) {
      return NextResponse.json({ error: '此訂單已退款，請勿重複操作' }, { status: 409 })
    }
    if (!REFUNDABLE_STATUSES.includes(order.status)) {
      return NextResponse.json({ error: `訂單狀態為「${order.status}」，無法退款` }, { status: 409 })
    }
    if (!order.tapPayRecTradeId) {
      return NextResponse.json({ error: '此訂單無 TapPay 交易紀錄，無法自動退款。請手動處理。' }, { status: 400 })
    }
    // 已被領取的轉贈擋退款（避免「轉贈後退款」詐騙）
    if (order.gift?.claimedAt) {
      const who = order.gift.toUser?.displayName ?? '對方'
      return NextResponse.json(
        { error: `此訂單已被「${who}」領取使用，無法自動退款。如需退款請聯絡客服。` },
        { status: 409 },
      )
    }

    // 2. 先打 TapPay refund — 失敗就 abort、DB 不動
    const refund = await tapPayRefund(
      order.tapPayRecTradeId,
      order.totalPaid,
      order.user.tenantAdminId ?? null,
    )
    if (!refund.ok) {
      return NextResponse.json(
        { error: `TapPay 退款失敗：${refund.message ?? '未知錯誤'}` },
        { status: 502 },
      )
    }

    // 3. TapPay 退款成功 → 更新 DB（訂單、分潤、優惠券、未領取的轉贈）
    await prisma.order.update({
      where: { id },
      data: { status: OrderStatus.REFUNDED },
    })
    await cancelCommission(id)
    const couponResult = await restoreCouponsForRefundedOrder(id)

    // 未領取的 gift 一併作廢（已領取的在上面已 abort，不會走到這）
    if (order.gift?.id && !order.gift.cancelledAt && !order.gift.claimedAt) {
      await prisma.orderGift.update({
        where: { id: order.gift.id },
        data: { cancelledAt: new Date(), cancelReason: 'order_refund' },
      })
    }

    return NextResponse.json({
      ok: true,
      refundedAmount:  order.totalPaid,
      restoredCoupons: couponResult.restored,
      voidedCoupons:   couponResult.voided,
    })
  }

  return NextResponse.json({ error: 'action 無效' }, { status: 400 })
}
