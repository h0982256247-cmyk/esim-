import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import {
  markOrderPaid,
  markBundlePaid,
  markOrderFailed,
  markBundleFailed,
  markOrderRefunded,
  markOrderCancelled,
  isOrderExpired,
} from '@/lib/services/order'
import { triggerEsimActivation } from '@/lib/services/esim'
import { calculateAndSaveCommission } from '@/lib/services/commission'
import { issueRepurchaseCouponForOrder } from '@/lib/services/coupon'
import { notifyOrderPaid } from '@/lib/services/notification'
import { tapPayRefund } from '@/lib/services/tappay'
import { encrypt } from '@/lib/utils/crypto'
import { OrderStatus } from '@prisma/client'

// POST /api/payment/tappay/notify
// TapPay webhook — fires for 3DS result and regular transactions
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ message: 'Bad request' }, { status: 400 })
  }

  const tapPayOrderId = body.order_number as string | undefined
  if (!tapPayOrderId) return NextResponse.json({ message: 'Missing order_number' }, { status: 400 })

  const order = await prisma.order.findFirst({
    where: { tapPayOrderId },
    include: {
      user: true,
      orderItems: { take: 1 },
    },
  })

  if (!order) return NextResponse.json({ message: 'Order not found' }, { status: 404 })

  // Verify partner_key header
  const apiKey = req.headers.get('x-api-key')
  const tenantAdminId = order.user.tenantAdminId
  let expectedKey: string | undefined

  if (tenantAdminId) {
    const cfg = await prisma.tenantPaymentConfig.findFirst({
      where: { adminId: tenantAdminId, gateway: 'tappay_credit', isActive: true },
    })
    expectedKey = cfg?.partnerKey ?? process.env.TAPPAY_PARTNER_KEY
  } else {
    expectedKey = process.env.TAPPAY_PARTNER_KEY
  }

  if (apiKey !== expectedKey) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  // Idempotent: skip already-completed orders
  if (order.status === OrderStatus.PAID || order.status === OrderStatus.COMPLETED) {
    return NextResponse.json({ message: 'Already processed' })
  }

  const status = body.status as number | undefined
  const recTradeId = (body.rec_trade_id as string | undefined) ?? ''

  // Bundle: TapPay only knows the anchor order_number; we fan out below.
  const bundleId = order.bundleId

  // 訂單已取消 或 建立時間超過 30 分鐘：若 TapPay 扣款成功立即退款
  const expired = isOrderExpired(order.createdAt)
  if (order.status === OrderStatus.CANCELLED || (expired && status === 0)) {
    if (status === 0 && recTradeId) {
      // For bundles, refund the full charged total (sum across the bundle).
      const refundAmount = bundleId
        ? (await prisma.order.aggregate({
            where: { bundleId },
            _sum: { totalPaid: true },
          }))._sum.totalPaid ?? order.totalPaid
        : order.totalPaid
      const refund = await tapPayRefund(recTradeId, refundAmount, order.user.tenantAdminId)
      if (refund.ok) {
        if (bundleId) {
          await prisma.order.updateMany({ where: { bundleId }, data: { status: OrderStatus.REFUNDED } })
        } else {
          await markOrderRefunded(order.id)
        }
        return NextResponse.json({ message: 'Order expired; payment refunded' })
      }
    }
    if (order.status !== OrderStatus.CANCELLED) await markOrderCancelled(order.id)
    return NextResponse.json({ message: 'Order expired; no action' })
  }

  if (status !== 0) {
    if (bundleId) await markBundleFailed(bundleId)
    else await markOrderFailed(order.id)
    return NextResponse.json({ message: 'Payment failed' })
  }

  // Mark paid — fan out across the bundle if applicable.
  let paidOrderIds: string[]
  if (bundleId) {
    const paidOrders = await markBundlePaid(bundleId, recTradeId)
    paidOrderIds = paidOrders.map(o => o.id)
  } else {
    await markOrderPaid(order.id, recTradeId)
    paidOrderIds = [order.id]
  }

  // Upsert saved card if card_secret returned (requires remember=true in the charge)
  const cardSecret = body.card_secret as { card_key?: string; card_token?: string } | undefined
  const card = body.card as { last_four?: string; type?: number; funding?: number; expiry_date?: string } | undefined

  if (cardSecret?.card_key && cardSecret?.card_token && card?.last_four) {
    // 拆 upsert：適配 @prisma/adapter-pg
    const cardData = {
      cardKeyEnc: encrypt(cardSecret.card_key),
      cardTokenEnc: encrypt(cardSecret.card_token),
      lastFour: card.last_four,
      cardType: card.type ?? 1,
      funding: card.funding ?? 0,
      cardExpiresAt: card.expiry_date ?? null,
    }
    const existing = await prisma.savedCard.findUnique({ where: { userId: order.userId } })
    if (existing) {
      await prisma.savedCard.update({ where: { userId: order.userId }, data: cardData })
    } else {
      await prisma.savedCard.create({ data: { userId: order.userId, ...cardData } })
    }
  }

  const productName = order.orderItems[0]?.productName ?? 'eSIM'
  for (const oid of paidOrderIds) {
    triggerEsimActivation(oid).catch(() => {})
    calculateAndSaveCommission(oid).catch(() => {})
    issueRepurchaseCouponForOrder(oid).catch(() => {})
  }

  if (bundleId && paidOrderIds.length > 1) {
    const totalAggregate = await prisma.order.aggregate({
      where: { bundleId },
      _sum: { totalPaid: true },
    })
    notifyOrderPaid(
      order.userId,
      `eSIM 組合 (${paidOrderIds.length} 張)`,
      totalAggregate._sum.totalPaid ?? order.totalPaid,
    ).catch(() => {})
  } else {
    notifyOrderPaid(order.userId, productName, order.totalPaid).catch(() => {})
  }

  return NextResponse.json({ message: 'ok' })
}
