import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAuth } from '@/lib/auth/platform'
import { prisma } from '@/lib/db/prisma'

type Params = { params: Promise<{ id: string }> }

// GET /api/platform/users/:id — 會員詳情（含優惠券、訂單、基本資料）
export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requirePlatformAuth(req)
  if (auth instanceof NextResponse) return auth

  const { id } = await params

  let user
  try {
    user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      lineUid: true,
      displayName: true,
      realName: true,
      avatarUrl: true,
      phone: true,
      email: true,
      birthday: true,
      tenantAdminId: true,
      createdAt: true,
      tenantAdmin: {
        select: { id: true, name: true, brandName: true },
      },
      ownedGroup: {
        select: { id: true, name: true, status: true, inviteCode: true },
      },
      groupMembership: {
        select: { joinedAt: true, group: { select: { id: true, name: true } } },
      },
      coupons: {
        where: { usedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
        select: {
          id: true,
          type: true,
          discount: true,
          expiresAt: true,
          isOfficial: true,
          sourceGroup: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
      orders: {
        select: {
          id: true,
          status: true,
          totalPaid: true,
          createdAt: true,
          paidAt: true,
          orderItems: { select: { productName: true }, take: 1 },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
    },
  })
  } catch (e) {
    console.error('User detail DB error:', e)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  if (!user) return NextResponse.json({ error: '會員不存在' }, { status: 404 })

  // Platform Admin 只能查看屬於自己租戶的會員
  if (auth.role !== 'SUPER_ADMIN' && user.tenantAdminId !== auth.tenantAdminId) {
    return NextResponse.json({ error: '無權限' }, { status: 403 })
  }

  return NextResponse.json({ user })
}
