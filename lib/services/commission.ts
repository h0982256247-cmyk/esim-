import { prisma } from '@/lib/db/prisma'
import { CommissionStatus } from '@prisma/client'

// ─── 分潤計算（付款成功後呼叫）──────────────────────────────────

// 計算基準：含稅實付金額
// ownerRate = 0.30 - rebateRate（讓利比例由社群主設定）
// commissionAmount = ROUND(paidAmount × ownerRate)
export async function calculateAndSaveCommission(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      totalPaid: true,
      status: true,
      commission: { select: { id: true } },
      orderCoupons: {
        select: {
          coupon: {
            select: { sourceGroupId: true, isOfficial: true, type: true },
          },
        },
      },
    },
  })

  if (!order) throw new Error(`Order ${orderId} not found`)
  if (order.commission) return // 冪等：已計算過就跳過

  // 找出分潤歸屬：取第一張有 sourceGroupId 的非官方社群券
  const commissionSource = order.orderCoupons
    .map(oc => oc.coupon)
    .find(c => c.sourceGroupId && !c.isOfficial && c.type !== 'GROUP_OWNER')

  if (!commissionSource?.sourceGroupId) return // 官方券 / 社群主7折券 → 不產生分潤

  const group = await prisma.group.findUnique({
    where: { id: commissionSource.sourceGroupId },
    select: { id: true, ownerId: true, rebateRate: true, status: true },
  })

  if (!group || group.status !== 'APPROVED') return

  const rebateRate = Number(group.rebateRate)
  const ownerRate = 0.30 - rebateRate
  if (ownerRate <= 0) return // 讓利 >= 30% 時平台無分潤，不建立記錄

  const commissionAmount = Math.round(order.totalPaid * ownerRate)

  // upsert 保證冪等（orderId unique constraint）
  await prisma.commission.upsert({
    where: { orderId },
    create: {
      orderId,
      groupId: group.id,
      groupOwnerId: group.ownerId,
      paidAmount: order.totalPaid,
      rebateRate,
      ownerRate,
      commissionAmount,
    },
    update: {},
  })
}

// ─── 月結：產生結算單 ─────────────────────────────────────────────

export async function settleCommissions(groupId: string, period: string): Promise<void> {
  // period = "YYYY-MM"
  const [year, month] = period.split('-').map(Number)
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 1)

  const commissions = await prisma.commission.findMany({
    where: {
      groupId,
      status: CommissionStatus.PENDING,
      order: { paidAt: { gte: start, lt: end } },
    },
    select: { id: true, commissionAmount: true },
  })

  if (commissions.length === 0) return

  const totalAmount = commissions.reduce((sum, c) => sum + c.commissionAmount, 0)
  const ids = commissions.map(c => c.id)

  await prisma.$transaction(async tx => {
    const settlement = await tx.commissionSettlement.upsert({
      where: { groupId_period: { groupId, period } },
      create: { groupId, period, totalAmount },
      update: { totalAmount: { increment: totalAmount } },
    })

    await tx.commission.updateMany({
      where: { id: { in: ids } },
      data: { status: CommissionStatus.SETTLED, settlementId: settlement.id },
    })
  })
}

// ─── 查詢 ─────────────────────────────────────────────────────────

export async function getGroupCommissions(groupId: string) {
  return prisma.commission.findMany({
    where: { groupId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      paidAmount: true,
      rebateRate: true,
      ownerRate: true,
      commissionAmount: true,
      status: true,
      createdAt: true,
      order: {
        select: {
          id: true,
          paidAt: true,
          orderItems: { select: { productName: true } },
        },
      },
    },
  })
}

export async function getGroupSettlements(groupId: string) {
  return prisma.commissionSettlement.findMany({
    where: { groupId },
    orderBy: { period: 'desc' },
    select: {
      id: true,
      period: true,
      totalAmount: true,
      status: true,
      paidAt: true,
      note: true,
    },
  })
}

export async function getPendingBalance(groupId: string): Promise<number> {
  const result = await prisma.commission.aggregate({
    where: { groupId, status: CommissionStatus.PENDING },
    _sum: { commissionAmount: true },
  })
  return result._sum.commissionAmount ?? 0
}

// ─── 退款取消分潤 ─────────────────────────────────────────────────

export async function cancelCommission(orderId: string): Promise<void> {
  await prisma.commission.updateMany({
    where: { orderId, status: CommissionStatus.PENDING },
    data: { status: CommissionStatus.CANCELLED },
  })
}

// ─── Admin：所有待結算分潤 ────────────────────────────────────────

export async function getAllPendingCommissions() {
  return prisma.commission.findMany({
    where: { status: CommissionStatus.PENDING },
    orderBy: { createdAt: 'desc' },
    include: {
      group: { select: { name: true } },
      order: { select: { paidAt: true } },
    },
  })
}
