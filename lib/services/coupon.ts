import { prisma } from '@/lib/db/prisma'
import type { CouponType, CouponLevel } from '@prisma/client'

// ─── 訂單付款後發回購券 ───────────────────────────────────────────

// 用戶付款成功後發給該用戶一張「下次購買可用」的回饋券。
// 折扣 = 1 − 用戶所屬社群當下的 rebateRate。
// rebateRate = 0 或未加入社群 → 不發券。
// 用 sourceOrderId 連結回原訂單，退款時可精準作廢未使用的券。
export async function issueRepurchaseCouponForOrder(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true, userId: true,
      user: {
        select: {
          id: true, lineUid: true,
          groupMembership: {
            where: { leftAt: null },
            select: {
              group: { select: { id: true, status: true, rebateRate: true } },
            },
          },
        },
      },
    },
  })

  if (!order) return
  const member = order.user?.groupMembership
  if (!member || member.group.status !== 'APPROVED') return

  const rebateRate = Number(member.group.rebateRate)
  if (rebateRate <= 0) return  // 無讓利 → 無券可發

  const discount = Math.round((1 - rebateRate) * 100) / 100

  // 冪等檢查：同一訂單已發過回購券就不再發
  const existing = await prisma.coupon.findFirst({
    where: { sourceOrderId: orderId, type: 'GROUP_REPURCHASE' },
    select: { id: true },
  })
  if (existing) return

  await prisma.coupon.create({
    data: {
      ownerId: order.user!.id,
      ownerUid: order.user!.lineUid,
      type: 'GROUP_REPURCHASE',
      level: getCouponLevel(discount),
      discount,
      isOfficial: false,
      sourceGroupId: member.group.id,
      sourceOrderId: orderId,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 天
    },
  })
}

// ─── 訂單退款：歸還已使用的券 + 作廢由該訂單發出的回購券 ──────────

export async function restoreCouponsForRefundedOrder(orderId: string): Promise<{ restored: number; voided: number }> {
  const now = new Date()
  const graceUntil = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)  // 14 天寬限

  return prisma.$transaction(async tx => {
    // 找出此訂單使用過的所有券
    const consumed = await tx.coupon.findMany({
      where: { usedOrderId: orderId },
      select: { id: true, expiresAt: true },
    })

    // 歸還：清 usedAt / usedOrderId；過期的話延 14 天
    for (const c of consumed) {
      await tx.coupon.update({
        where: { id: c.id },
        data: {
          usedAt: null,
          usedOrderId: null,
          expiresAt: c.expiresAt && c.expiresAt < now ? graceUntil : c.expiresAt,
        },
      })
    }

    // 作廢此訂單發出但未使用的回購券
    const voided = await tx.coupon.updateMany({
      where: {
        sourceOrderId: orderId,
        usedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      data: { expiresAt: now },
    })

    return { restored: consumed.length, voided: voided.count }
  })
}

export interface IssueCouponInput {
  ownerId: string
  ownerUid: string
  type: CouponType
  discount: number          // 0.70 ~ 0.99
  isOfficial?: boolean
  sourceGroupId?: string
  expiresAt?: Date
}

export function getCouponLevel(discount: number): CouponLevel {
  if (discount < 0.8) return 'A'
  if (discount < 0.9) return 'B'
  return 'C'
}

export async function issueCoupon(input: IssueCouponInput) {
  return prisma.coupon.create({
    data: {
      ownerId: input.ownerId,
      ownerUid: input.ownerUid,
      type: input.type,
      level: getCouponLevel(input.discount),
      discount: input.discount,
      isOfficial: input.isOfficial ?? false,
      sourceGroupId: input.sourceGroupId ?? null,
      expiresAt: input.expiresAt ?? null,
    },
  })
}

// ─── 驗證組合規則（A/B/C 等級）────────────────────────────────────

export function validateCouponCombination(discounts: number[]): { valid: boolean; reason?: string } {
  if (discounts.length === 0) return { valid: true }

  const levels = discounts.map(getCouponLevel)

  if (levels.includes('A') && levels.length > 1) {
    return { valid: false, reason: 'A 級券不可與其他券併用' }
  }

  const bCount = levels.filter(l => l === 'B').length
  const cCount = levels.filter(l => l === 'C').length

  if (bCount > 1) {
    return { valid: false, reason: '不可同時使用多張 B 級券' }
  }
  if (bCount > 0 && cCount > 1) {
    return { valid: false, reason: 'B 級券最多只能搭配 1 張 C 級券' }
  }
  if (cCount > 3) {
    return { valid: false, reason: 'C 級券最多同時使用 3 張' }
  }

  return { valid: true }
}

// 連續折扣計算（非加總）
export function calculateFinalPrice(price: number, discounts: number[]): number {
  const result = discounts.reduce((acc, d) => acc * d, price)
  return Math.round(result)
}

// ─── 查詢 ─────────────────────────────────────────────────────────

export async function getUserCoupons(userId: string) {
  const now = new Date()
  return prisma.coupon.findMany({
    where: {
      ownerId: userId,
      usedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      type: true,
      level: true,
      discount: true,
      isOfficial: true,
      expiresAt: true,
      createdAt: true,
      sourceGroupId: true,
    },
  })
}

export async function getUserCouponsIncludingUsed(userId: string) {
  return prisma.coupon.findMany({
    where: { ownerId: userId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      type: true,
      level: true,
      discount: true,
      isOfficial: true,
      expiresAt: true,
      usedAt: true,
      createdAt: true,
    },
  })
}

// ─── 驗證所有權與有效性 ───────────────────────────────────────────

export type CouponValidationResult =
  | { ok: true; coupon: { id: string; discount: number; level: CouponLevel; sourceGroupId: string | null } }
  | { ok: false; reason: string }

export async function validateCouponOwnership(
  couponId: string,
  lineUid: string
): Promise<CouponValidationResult> {
  const coupon = await prisma.coupon.findUnique({
    where: { id: couponId },
    select: {
      id: true,
      ownerUid: true,
      discount: true,
      level: true,
      usedAt: true,
      expiresAt: true,
      sourceGroupId: true,
    },
  })

  if (!coupon) return { ok: false, reason: '優惠券不存在' }
  if (coupon.ownerUid !== lineUid) return { ok: false, reason: '此優惠券不屬於你' }
  if (coupon.usedAt) return { ok: false, reason: '此優惠券已使用' }
  if (coupon.expiresAt && coupon.expiresAt < new Date()) return { ok: false, reason: '此優惠券已過期' }

  return {
    ok: true,
    coupon: {
      id: coupon.id,
      discount: Number(coupon.discount),
      level: coupon.level,
      sourceGroupId: coupon.sourceGroupId,
    },
  }
}

// ─── Admin 發券 ───────────────────────────────────────────────────

export interface BatchIssueCouponInput {
  userIds: string[]          // User.id 列表
  type: CouponType
  discount: number
  isOfficial?: boolean
  sourceGroupId?: string
  expiresAt?: Date
}

export async function batchIssueCoupons(input: BatchIssueCouponInput): Promise<{ count: number }> {
  // 先取得這些 user 的 id + lineUid
  const users = await prisma.user.findMany({
    where: { id: { in: input.userIds } },
    select: { id: true, lineUid: true },
  })

  const level = getCouponLevel(input.discount)

  const result = await prisma.coupon.createMany({
    data: users.map(u => ({
      ownerId: u.id,
      ownerUid: u.lineUid,
      type: input.type,
      level,
      discount: input.discount,
      isOfficial: input.isOfficial ?? false,
      sourceGroupId: input.sourceGroupId ?? null,
      expiresAt: input.expiresAt ?? null,
    })),
  })

  return { count: result.count }
}
