import { prisma } from '@/lib/db/prisma'
import { issueCoupon } from '@/lib/services/coupon'
import type { LineUserInfo } from '@/lib/auth/line'

export interface UpdateProfileInput {
  name: string
  phone: string
  email: string
  birthday: Date
}

export async function findOrCreateUser(lineInfo: LineUserInfo, tenantAdminId?: string) {
  const existing = await prisma.user.findUnique({
    where: { lineUid: lineInfo.sub },
  })

  if (existing) {
    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: {
        displayName: lineInfo.name,
        avatarUrl: lineInfo.picture ?? existing.avatarUrl,
        // 只在尚未設定租戶時才寫入（防止跨租戶登入覆蓋）
        ...(tenantAdminId && !existing.tenantAdminId ? { tenantAdminId } : {}),
      },
    })
    return { user: updated, isNewUser: false }
  }

  const user = await prisma.user.create({
    data: {
      lineUid: lineInfo.sub,
      displayName: lineInfo.name,
      avatarUrl: lineInfo.picture,
      tenantAdminId: tenantAdminId ?? null,
    },
  })

  return { user, isNewUser: true }
}

export async function updateProfile(userId: string, input: UpdateProfileInput) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })

  const isFirstUpdate = !user.phone && !user.email

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      realName: input.name,
      phone: input.phone,   // TODO: 加密
      email: input.email,   // TODO: 加密
      birthday: input.birthday,
    },
  })

  // 首次填寫個資 → 發放官方歡迎券（C 級 9 折）
  if (isFirstUpdate) {
    await issueCoupon({
      ownerId: userId,
      ownerUid: updated.lineUid,
      type: 'OFFICIAL_WELCOME',
      discount: 0.9,
      isOfficial: true,
    })
  }

  return updated
}

export async function getUserById(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: {
      groupMembership: { include: { group: true } },
      ownedGroup: true,
    },
  })
}

export function isProfileComplete(user: { realName?: string | null; phone: string | null; email: string | null; birthday: Date | null }) {
  return !!(user.realName && user.phone && user.email && user.birthday)
}
