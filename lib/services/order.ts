import { prisma } from '@/lib/db/prisma'
import { OrderStatus, PaymentMethod } from '@prisma/client'
import { validateCouponOwnership, validateCouponCombination, calculateFinalPrice, markCouponUsed } from './coupon'
import { getProductById } from './product'

// ─── 訂單號生成 ───────────────────────────────────────────────────
// 格式：ESM-YYMMDD-XXXXXX（去除易混淆字元 I/O/0/1）
const ORDER_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function generateOrderNumber(): string {
  const now = new Date()
  const yy = String(now.getFullYear()).slice(2)
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const suffix = Array.from({ length: 6 }, () =>
    ORDER_CHARS[Math.floor(Math.random() * ORDER_CHARS.length)]
  ).join('')
  return `ESM-${yy}${mm}${dd}-${suffix}`
}

// ─── 建立訂單（結帳第一步）────────────────────────────────────────

export interface CreateOrderInput {
  userId: string
  lineUid: string
  productId: string
  couponIds: string[]
  paymentMethod: PaymentMethod
}

export type CreateOrderResult =
  | { ok: true; orderId: string; orderNumber: string; totalPaid: number; subtotal: number; discountAmount: number }
  | { ok: false; reason: string }

export async function createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  const product = await getProductById(input.productId)
  if (!product) return { ok: false, reason: '商品不存在或已下架' }

  const subtotal = product.sellPrice

  // 驗證優惠券
  const validatedCoupons: Array<{ id: string; discount: number; sourceGroupId: string | null }> = []
  for (const cid of input.couponIds) {
    const r = await validateCouponOwnership(cid, input.lineUid)
    if (!r.ok) return { ok: false, reason: r.reason }
    validatedCoupons.push(r.coupon)
  }

  const discounts = validatedCoupons.map(c => c.discount)
  const combo = validateCouponCombination(discounts)
  if (!combo.valid) return { ok: false, reason: combo.reason ?? '優惠券組合無效' }

  const totalPaid = calculateFinalPrice(subtotal, discounts)
  const discountAmount = subtotal - totalPaid

  // 生成訂單號（衝突時最多重試 3 次）
  let orderNumber = generateOrderNumber()
  for (let attempt = 0; attempt < 3; attempt++) {
    const exists = await prisma.order.findUnique({ where: { orderNumber } })
    if (!exists) break
    orderNumber = generateOrderNumber()
  }

  const order = await prisma.$transaction(async tx => {
    const o = await tx.order.create({
      data: {
        userId: input.userId,
        currentOwnerId: input.userId,   // 預設買家就是擁有者；轉贈後會改成接收者
        orderNumber,
        status: OrderStatus.PENDING,
        subtotal,
        discountAmount,
        totalPaid,
        taxAmount: 0,
        paymentMethod: input.paymentMethod,
        orderItems: {
          create: {
            productId: input.productId,
            productName: `${product.countryNameZh} ${product.displayDays}天`,
            qty: 1,
            unitPrice: subtotal,
            unitCost: product.costPrice,   // 鎖死成本快照，後續供應商改價不影響歷史訂單
          },
        },
        orderCoupons: {
          create: validatedCoupons.map(c => ({
            couponId: c.id,
            discountApplied: c.discount,
          })),
        },
      },
    })

    // 標記優惠券已使用
    for (const c of validatedCoupons) {
      await tx.coupon.update({
        where: { id: c.id },
        data: { usedAt: new Date(), usedOrderId: o.id },
      })
    }

    return o
  })

  return {
    ok: true,
    orderId: order.id,
    orderNumber: order.orderNumber ?? orderNumber,
    totalPaid,
    subtotal,
    discountAmount,
  }
}

// ─── 逾時判斷（30 分鐘）─────────────────────────────────────────────
export const ORDER_EXPIRY_MS = 30 * 60 * 1000

export function isOrderExpired(createdAt: Date): boolean {
  return Date.now() - createdAt.getTime() > ORDER_EXPIRY_MS
}

// ─── 訂單狀態更新 ─────────────────────────────────────────────────

export async function markOrderProcessing(orderId: string, tapPayOrderId: string) {
  return prisma.order.update({
    where: { id: orderId },
    data: { status: OrderStatus.PROCESSING, tapPayOrderId },
  })
}

export async function markOrderPaid(orderId: string, tapPayRecTradeId: string) {
  return prisma.order.update({
    where: { id: orderId },
    data: {
      status: OrderStatus.PAID,
      tapPayRecTradeId,
      paidAt: new Date(),
    },
  })
}

export async function markOrderFailed(orderId: string) {
  // 一併歸還訂單創建時佔用的優惠券（usedAt/usedOrderId 還原）
  // 保留原 expiresAt，因為券「沒實際被消耗」，不需要寬限期
  return prisma.$transaction(async tx => {
    await tx.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.FAILED },
    })
    await tx.coupon.updateMany({
      where: { usedOrderId: orderId },
      data: { usedAt: null, usedOrderId: null },
    })
  })
}

export async function markOrderCancelled(orderId: string) {
  return prisma.$transaction(async tx => {
    await tx.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.CANCELLED },
    })
    await tx.coupon.updateMany({
      where: { usedOrderId: orderId },
      data: { usedAt: null, usedOrderId: null },
    })
  })
}

export async function markOrderRefunded(orderId: string) {
  return prisma.order.update({
    where: { id: orderId },
    data: { status: OrderStatus.REFUNDED },
  })
}

// 取消超過 30 分鐘仍為 PENDING 的訂單，並歸還該訂單佔用的優惠券
export async function cancelExpiredPendingOrders(): Promise<number> {
  const cutoff = new Date(Date.now() - 30 * 60 * 1000)

  return prisma.$transaction(async tx => {
    const expired = await tx.order.findMany({
      where: { status: OrderStatus.PENDING, createdAt: { lt: cutoff } },
      select: { id: true },
    })
    if (expired.length === 0) return 0

    const ids = expired.map(o => o.id)
    await tx.order.updateMany({
      where: { id: { in: ids } },
      data: { status: OrderStatus.CANCELLED },
    })
    await tx.coupon.updateMany({
      where: { usedOrderId: { in: ids } },
      data: { usedAt: null, usedOrderId: null },
    })
    return ids.length
  })
}

export async function markOrderEsimPending(orderId: string) {
  return prisma.order.update({
    where: { id: orderId },
    data: { status: OrderStatus.ESIM_PENDING },
  })
}

export async function markOrderCompleted(orderId: string, esimData: {
  wmOrderId?: string
  wmOrderSn?: string
  wmOrderTime?: string
  esimRcode?: string
  esimQrcode?: string
  esimLpa?: string
  esimPin1?: string
  esimPin2?: string
  esimPuk1?: string
  esimPuk2?: string
  esimCfCode?: string
  esimApnExplain?: string
  esimIccid?: string
  activationStart?: Date
  activationEnd?: Date
}) {
  return prisma.order.update({
    where: { id: orderId },
    data: {
      status: OrderStatus.COMPLETED,
      ...esimData,
    },
  })
}

// ─── 查詢 ─────────────────────────────────────────────────────────

export async function getUserOrders(userId: string) {
  // 用 currentOwnerId 取「目前擁有的訂單」（含轉贈進來的）
  return prisma.order.findMany({
    where: { currentOwnerId: userId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      totalPaid: true,
      subtotal: true,
      discountAmount: true,
      paymentMethod: true,
      paidAt: true,
      createdAt: true,
      userId: true,
      currentOwnerId: true,
      esimRcode: true,
      esimQrcode: true,
      redeemedAt: true,
      activatedAt: true,
      orderItems: {
        select: { productName: true, qty: true, unitPrice: true },
      },
      gift: {
        select: {
          claimedAt: true,
          cancelledAt: true,
          expiresAt: true,
          fromUser:    { select: { displayName: true } },
          toUser:      { select: { displayName: true } },
          recipientName: true,
        },
      },
    },
  })
}

export async function getOrderById(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: {
      orderItems: true,
      orderCoupons: { include: { coupon: { select: { type: true, discount: true } } } },
    },
  })
}

export async function getOrderByIdForUser(orderId: string, userId: string) {
  // 用 currentOwnerId 查詢：原買家轉贈出去後就不再能存取此訂單細節（QR/兌換碼）
  return prisma.order.findFirst({
    where: { id: orderId, currentOwnerId: userId },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      subtotal: true,
      discountAmount: true,
      totalPaid: true,
      paymentMethod: true,
      paidAt: true,
      createdAt: true,
      updatedAt: true,
      userId: true,
      currentOwnerId: true,
      esimRcode: true,
      esimQrcode: true,
      esimLpa: true,
      esimIccid: true,
      activationStart: true,
      activationEnd: true,
      redeemedAt: true,
      activatedAt: true,
      orderItems: {
        select: { productName: true, qty: true, unitPrice: true },
      },
      gift: {
        select: {
          token: true,
          sharedAt: true,
          expiresAt: true,
          claimedAt: true,
          cancelledAt: true,
          recipientName: true,
          toUser: { select: { displayName: true } },
        },
      },
    },
  })
}

// ─── Retry 計數 ───────────────────────────────────────────────────

export async function incrementRetryCount(orderId: string) {
  return prisma.order.update({
    where: { id: orderId },
    data: { retryCount: { increment: 1 }, lastRetryAt: new Date() },
  })
}
