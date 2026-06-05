import { prisma } from '@/lib/db/prisma'
import { OrderStatus, PaymentMethod } from '@prisma/client'
import { validateCouponOwnership, validateCouponCombination, calculateFinalPrice, markCouponUsed } from './coupon'
import { getProductById } from './product'

// ─── 建立訂單（結帳第一步）────────────────────────────────────────

export interface CreateOrderInput {
  userId: string
  lineUid: string
  productId: string
  couponIds: string[]
  paymentMethod: PaymentMethod
}

export type CreateOrderResult =
  | { ok: true; orderId: string; totalPaid: number; subtotal: number; discountAmount: number }
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

  const order = await prisma.$transaction(async tx => {
    const o = await tx.order.create({
      data: {
        userId: input.userId,
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
    totalPaid,
    subtotal,
    discountAmount,
  }
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
  return prisma.order.update({
    where: { id: orderId },
    data: { status: OrderStatus.FAILED },
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
  return prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      status: true,
      totalPaid: true,
      subtotal: true,
      discountAmount: true,
      paymentMethod: true,
      paidAt: true,
      createdAt: true,
      orderItems: {
        select: { productName: true, qty: true, unitPrice: true },
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
  return prisma.order.findFirst({
    where: { id: orderId, userId },
    select: {
      id: true,
      status: true,
      subtotal: true,
      discountAmount: true,
      totalPaid: true,
      paymentMethod: true,
      paidAt: true,
      createdAt: true,
      esimRcode: true,
      esimQrcode: true,
      esimLpa: true,
      esimIccid: true,
      activationStart: true,
      activationEnd: true,
      orderItems: {
        select: { productName: true, qty: true, unitPrice: true },
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
