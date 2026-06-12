import { prisma } from '@/lib/db/prisma'
import { OrderStatus, PaymentMethod } from '@prisma/client'
import { validateCouponOwnership, validateCouponCombination, calculateFinalPrice } from './coupon'
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

  let order
  try {
    order = await prisma.$transaction(async tx => {
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

      // 標記優惠券已使用：條件式 updateMany（usedAt 必須仍為 null）。
      // 兩筆並發結帳用同一張券時，只有一筆會 count===1，另一筆 throw → 整筆 rollback，
      // 避免同券雙花。
      for (const c of validatedCoupons) {
        const r = await tx.coupon.updateMany({
          where: { id: c.id, usedAt: null },
          data: { usedAt: new Date(), usedOrderId: o.id },
        })
        if (r.count !== 1) throw new Error('COUPON_ALREADY_USED')
      }

      return o
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'COUPON_ALREADY_USED') {
      return { ok: false, reason: '優惠券已被使用，請重新整理後再試' }
    }
    throw err
  }

  return {
    ok: true,
    orderId: order.id,
    orderNumber: order.orderNumber ?? orderNumber,
    totalPaid,
    subtotal,
    discountAmount,
  }
}

// ─── 建立多品項訂單包（cart 一次結帳 N 張 eSIM）─────────────────────
//
// Schema constraint: each Order maps to one supplier eSIM (esimRcode/wmOrderId
// live on Order itself, not OrderItem). So a multi-item cart is materialized
// as N independent Orders sharing a `bundleId`. The TapPay charge happens
// once for the sum; the notify webhook fans out to every order in the bundle.
//
// Coupons are intentionally NOT supported here in v1 — the existing single-
// order coupon validation assumes one subtotal.

export interface BundleCartLine {
  productId: string
  qty: number    // 1-9, expanded into N orders
}

export interface CreateBundleOrdersInput {
  userId: string
  lineUid: string
  lines: BundleCartLine[]
  paymentMethod: PaymentMethod
}

export type CreateBundleOrdersResult =
  | { ok: true; bundleId: string; orderIds: string[]; orderCount: number; subtotal: number; totalPaid: number }
  | { ok: false; reason: string }

const MAX_BUNDLE_ITEMS = 20

function generateBundleId(): string {
  // Short URL-safe id; collision space is large because it's scoped to one user.
  return 'BDL-' + Array.from({ length: 12 }, () =>
    ORDER_CHARS[Math.floor(Math.random() * ORDER_CHARS.length)]
  ).join('')
}

export async function createBundleOrders(input: CreateBundleOrdersInput): Promise<CreateBundleOrdersResult> {
  if (!input.lines || input.lines.length === 0) {
    return { ok: false, reason: '購物車是空的' }
  }

  // Expand qty into individual order slots
  const slots: { productId: string }[] = []
  for (const line of input.lines) {
    const qty = Math.max(1, Math.min(9, Math.floor(line.qty || 1)))
    for (let i = 0; i < qty; i++) slots.push({ productId: line.productId })
  }

  if (slots.length === 0) return { ok: false, reason: '購物車是空的' }
  if (slots.length > MAX_BUNDLE_ITEMS) {
    return { ok: false, reason: `單次結帳最多 ${MAX_BUNDLE_ITEMS} 張，請拆批購買` }
  }

  // Fetch products once (dedupe by id)
  const uniqueIds = Array.from(new Set(slots.map(s => s.productId)))
  const products = await Promise.all(uniqueIds.map(id => getProductById(id)))
  const productMap = new Map<string, NonNullable<Awaited<ReturnType<typeof getProductById>>>>()
  for (let i = 0; i < uniqueIds.length; i++) {
    const p = products[i]
    if (!p) return { ok: false, reason: `商品不存在或已下架：${uniqueIds[i]}` }
    productMap.set(uniqueIds[i], p)
  }

  const subtotal = slots.reduce((sum, s) => sum + (productMap.get(s.productId)?.sellPrice ?? 0), 0)
  const totalPaid = subtotal   // no coupons in v1
  const bundleId = generateBundleId()

  // Pre-generate unique order numbers OUTSIDE the transaction. The uniqueness
  // probe (findUnique) is the slow part — running it inside the interactive
  // transaction keeps a DB connection pinned for the whole batch, which on a
  // remote DB behind PgBouncer easily blows past Prisma's 5s transaction
  // timeout (→ P2028 throw → 500 → frontend shows「網路錯誤」). Generating the
  // numbers up front means the transaction only does the N inserts.
  const usedNumbers = new Set<string>()
  const orderNumbers: string[] = []
  for (let i = 0; i < slots.length; i++) {
    let orderNumber = generateOrderNumber()
    for (let attempt = 0; attempt < 5; attempt++) {
      const collides = usedNumbers.has(orderNumber)
        || (await prisma.order.findUnique({ where: { orderNumber }, select: { id: true } })) !== null
      if (!collides) break
      orderNumber = generateOrderNumber()
    }
    usedNumbers.add(orderNumber)
    orderNumbers.push(orderNumber)
  }

  let orderIds: string[]
  try {
    orderIds = await prisma.$transaction(async tx => {
      const ids: string[] = []
      for (let i = 0; i < slots.length; i++) {
        const p = productMap.get(slots[i].productId)!
        const o = await tx.order.create({
          data: {
            userId: input.userId,
            currentOwnerId: input.userId,
            orderNumber: orderNumbers[i],
            bundleId,
            bundleSeq: i + 1,
            status: OrderStatus.PENDING,
            subtotal: p.sellPrice,
            discountAmount: 0,
            totalPaid: p.sellPrice,
            taxAmount: 0,
            paymentMethod: input.paymentMethod,
            orderItems: {
              create: {
                productId: p.id,
                productName: `${p.countryNameZh} ${p.displayDays}天`,
                qty: 1,
                unitPrice: p.sellPrice,
                unitCost: p.costPrice,
              },
            },
          },
        })
        ids.push(o.id)
      }
      return ids
    }, {
      // N sequential inserts over a remote/pooled connection need headroom
      // beyond Prisma's 5s default; otherwise large carts throw P2028.
      timeout: 20_000,
      maxWait: 10_000,
    })
  } catch (err) {
    const reason = err instanceof Error ? err.message : '建立訂單失敗'
    return { ok: false, reason: `建立訂單失敗：${reason}` }
  }

  return {
    ok: true,
    bundleId,
    orderIds,
    orderCount: orderIds.length,
    subtotal,
    totalPaid,
  }
}

export async function getBundleOrders(bundleId: string, userId: string) {
  return prisma.order.findMany({
    where: { bundleId, userId },
    orderBy: { bundleSeq: 'asc' },
    include: {
      orderItems: { select: { productName: true, qty: true, unitPrice: true, productId: true } },
    },
  })
}

// ─── 逾時判斷（30 分鐘）─────────────────────────────────────────────
export const ORDER_EXPIRY_MS = 30 * 60 * 1000

export function isOrderExpired(createdAt: Date): boolean {
  return Date.now() - createdAt.getTime() > ORDER_EXPIRY_MS
}

// ─── 訂單狀態更新 ─────────────────────────────────────────────────

// 只把 PENDING → PROCESSING（條件式 updateMany）。回傳是否真的取得鎖：
// 兩個並發付款請求只有一個會 count===1，另一個 count===0 → 呼叫端中止，避免重複扣款。
export async function markOrderProcessing(orderId: string, tapPayOrderId: string): Promise<boolean> {
  const r = await prisma.order.updateMany({
    where: { id: orderId, status: OrderStatus.PENDING },
    data: { status: OrderStatus.PROCESSING, tapPayOrderId },
  })
  return r.count === 1
}

export async function markBundleOrdersProcessing(bundleId: string, anchorOrderId: string, tapPayOrderId: string): Promise<boolean> {
  // Only the anchor carries the unique tapPayOrderId; the rest just flip status.
  // 以 anchor 的條件式更新當作整組的鎖：搶不到 anchor 就整組中止。
  return prisma.$transaction(async tx => {
    const anchor = await tx.order.updateMany({
      where: { id: anchorOrderId, status: OrderStatus.PENDING },
      data: { status: OrderStatus.PROCESSING, tapPayOrderId },
    })
    if (anchor.count !== 1) return false
    await tx.order.updateMany({
      where: { bundleId, id: { not: anchorOrderId }, status: OrderStatus.PENDING },
      data: { status: OrderStatus.PROCESSING },
    })
    return true
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

export async function markBundlePaid(bundleId: string, tapPayRecTradeId: string) {
  // Fan out the anchor's PAID status (and the shared recTradeId) to every
  // sibling in the bundle. Returns the affected order ids so the caller can
  // trigger eSIM activation per-order.
  const paidAt = new Date()
  await prisma.order.updateMany({
    where: { bundleId, status: { in: [OrderStatus.PENDING, OrderStatus.PROCESSING] } },
    data: { status: OrderStatus.PAID, tapPayRecTradeId, paidAt },
  })
  const orders = await prisma.order.findMany({
    where: { bundleId },
    select: { id: true, userId: true, totalPaid: true, orderItems: { select: { productName: true }, take: 1 } },
    orderBy: { bundleSeq: 'asc' },
  })
  return orders
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

export async function markBundleFailed(bundleId: string) {
  return prisma.$transaction(async tx => {
    await tx.order.updateMany({
      where: { bundleId, status: { in: [OrderStatus.PENDING, OrderStatus.PROCESSING] } },
      data: { status: OrderStatus.FAILED },
    })
    // Bundle orders are coupon-less in v1, but keep this for forward compat.
    const orders = await tx.order.findMany({ where: { bundleId }, select: { id: true } })
    await tx.coupon.updateMany({
      where: { usedOrderId: { in: orders.map(o => o.id) } },
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

// 取消超過 30 分鐘未完成付款的訂單，並歸還該訂單佔用的優惠券。
// 涵蓋 PENDING（尚未送出金流）與 PROCESSING（已送出／3DS 進行中但使用者放棄、
// 銀行未回傳 notify）——後者若稍後仍收到成功 notify，notify route 會走
// 「訂單已 CANCELLED → 自動退款」保護路徑，不會誤發卡。
export async function cancelExpiredPendingOrders(): Promise<number> {
  const cutoff = new Date(Date.now() - 30 * 60 * 1000)

  return prisma.$transaction(async tx => {
    const expired = await tx.order.findMany({
      where: {
        status: { in: [OrderStatus.PENDING, OrderStatus.PROCESSING] },
        createdAt: { lt: cutoff },
      },
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
