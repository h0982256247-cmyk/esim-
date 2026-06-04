import { prisma } from '@/lib/db/prisma'
import { GroupStatus } from '@prisma/client'
import { issueCoupon } from './coupon'
import { notifyGroupApproved, notifyGroupRejected } from './notification'
import { randomBytes } from 'crypto'

// ─── 申請社群主 ───────────────────────────────────────────────────

export interface ApplyGroupInput {
  userId: string
  name: string
  description?: string
  type?: string
  tenantAdminId?: string
}

export async function applyGroup(input: ApplyGroupInput) {
  const existing = await prisma.group.findUnique({ where: { ownerId: input.userId } })
  if (existing) throw new Error('已有社群，不可重複申請')

  return prisma.group.create({
    data: {
      ownerId: input.userId,
      name: input.name,
      description: input.description,
      type: input.type,
      status: GroupStatus.PENDING,
      inviteCode: randomBytes(4).toString('hex').toUpperCase(),
      tenantAdminId: input.tenantAdminId ?? null,
    },
  })
}

// ─── 加入社群 ─────────────────────────────────────────────────────

export type JoinGroupResult =
  | { ok: true; groupName: string }
  | { ok: false; reason: string }

export async function joinGroup(userId: string, lineUid: string, inviteCode: string): Promise<JoinGroupResult> {
  const group = await prisma.group.findUnique({
    where: { inviteCode },
    select: { id: true, name: true, status: true, ownerId: true, rebateRate: true },
  })

  if (!group) return { ok: false, reason: '邀請碼無效' }
  if (group.status !== GroupStatus.APPROVED) return { ok: false, reason: '此社群尚未核准' }
  if (group.ownerId === userId) return { ok: false, reason: '社群主不能加入自己的社群' }

  const existing = await prisma.groupMember.findUnique({ where: { userId } })
  if (existing) return { ok: false, reason: '已屬於其他社群，如需換群請聯絡客服' }

  await prisma.$transaction(async tx => {
    await tx.groupMember.create({
      data: { groupId: group.id, userId },
    })

    // 發放入群券（C 級，折扣視讓利比例 → 固定 0.95）
    const user = await tx.user.findUnique({ where: { id: userId }, select: { id: true, lineUid: true } })
    if (user) {
      await tx.coupon.create({
        data: {
          ownerId: user.id,
          ownerUid: user.lineUid,
          type: 'GROUP_JOIN',
          level: 'C',
          discount: 0.95,
          isOfficial: false,
          sourceGroupId: group.id,
          expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 天
        },
      })
    }
  })

  return { ok: true, groupName: group.name }
}

// ─── 社群主後台：設定讓利比例 ─────────────────────────────────────

export async function setRebateRate(groupId: string, ownerId: string, rebateRate: number) {
  if (rebateRate < 0 || rebateRate > 0.3) throw new Error('讓利比例須介於 0 ~ 0.30')

  return prisma.group.update({
    where: { id: groupId, ownerId }, // 確保只有群主可改
    data: { rebateRate },
  })
}

// ─── 社群主後台：發送活動券 ───────────────────────────────────────

export async function issueActivityCoupon(
  groupId: string,
  ownerId: string,
  targetUserIds: string[],
  discount: number,
  expiresAt?: Date
) {
  const group = await prisma.group.findUnique({
    where: { id: groupId, ownerId },
    select: { id: true, activityCouponQuota: true, status: true },
  })

  if (!group || group.status !== GroupStatus.APPROVED) throw new Error('無效的社群')
  if (group.activityCouponQuota <= 0) throw new Error('本月活動券發送次數已用完')
  if (discount < 0.8 || discount >= 1) throw new Error('活動券折扣須介於 0.80 ~ 0.99')

  const users = await prisma.user.findMany({
    where: { id: { in: targetUserIds } },
    select: { id: true, lineUid: true },
  })

  await prisma.$transaction(async tx => {
    await tx.coupon.createMany({
      data: users.map(u => ({
        ownerId: u.id,
        ownerUid: u.lineUid,
        type: 'GROUP_ACTIVITY' as const,
        level: 'C' as const,
        discount,
        isOfficial: false,
        sourceGroupId: groupId,
        expiresAt: expiresAt ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      })),
    })

    // 扣除配額
    await tx.group.update({
      where: { id: groupId },
      data: { activityCouponQuota: { decrement: 1 } },
    })
  })
}

// ─── 查詢 ─────────────────────────────────────────────────────────

export async function getGroupByOwnerId(ownerId: string) {
  return prisma.group.findUnique({
    where: { ownerId },
    include: {
      members: {
        where: { leftAt: null },
        include: { user: { select: { id: true, displayName: true, avatarUrl: true, createdAt: true } } },
        orderBy: { joinedAt: 'desc' },
      },
    },
  })
}

export async function getGroupByInviteCode(inviteCode: string) {
  return prisma.group.findUnique({
    where: { inviteCode },
    select: { id: true, name: true, description: true, type: true, status: true },
  })
}

export async function getUserGroup(userId: string) {
  return prisma.groupMember.findUnique({
    where: { userId },
    include: { group: { select: { id: true, name: true, description: true, inviteCode: true } } },
  })
}

// ─── Admin：審核社群申請 ──────────────────────────────────────────

export async function approveGroup(groupId: string, tenantAdminId?: string | null) {
  if (tenantAdminId != null) {
    const existing = await prisma.group.findUnique({ where: { id: groupId }, select: { tenantAdminId: true } })
    if (!existing || existing.tenantAdminId !== tenantAdminId) throw new Error('無權操作此社群')
  }

  const group = await prisma.group.update({
    where: { id: groupId },
    data: { status: GroupStatus.APPROVED, approvedAt: new Date() },
    include: { owner: { select: { id: true, lineUid: true } } },
  })

  // 發社群主 7 折券（A 級，永久有效）
  await issueCoupon({
    ownerId: group.owner.id,
    ownerUid: group.owner.lineUid,
    type: 'GROUP_OWNER',
    discount: 0.7,
    isOfficial: false,
    sourceGroupId: group.id,
  })

  notifyGroupApproved(group.owner.id, group.name).catch(() => {})
  return group
}

export async function rejectGroup(groupId: string, note?: string, tenantAdminId?: string | null) {
  if (tenantAdminId != null) {
    const existing = await prisma.group.findUnique({ where: { id: groupId }, select: { tenantAdminId: true } })
    if (!existing || existing.tenantAdminId !== tenantAdminId) throw new Error('無權操作此社群')
  }

  const group = await prisma.group.update({
    where: { id: groupId },
    data: { status: GroupStatus.REJECTED },
    include: { owner: { select: { id: true } } },
  })
  notifyGroupRejected(group.owner.id, group.name).catch(() => {})
  return group
}

export async function getAllGroups(status?: GroupStatus, tenantAdminId?: string | null) {
  const where: Record<string, unknown> = {}
  if (status) where.status = status
  if (tenantAdminId !== undefined && tenantAdminId !== null) where.tenantAdminId = tenantAdminId

  return prisma.group.findMany({
    where: Object.keys(where).length > 0 ? where : undefined,
    orderBy: { createdAt: 'desc' },
    include: {
      owner: { select: { displayName: true, lineUid: true } },
      _count: { select: { members: true } },
    },
  })
}
