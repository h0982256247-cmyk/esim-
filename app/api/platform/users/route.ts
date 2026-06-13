import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAuth } from '@/lib/auth/platform'
import { prisma } from '@/lib/db/prisma'
import { Prisma } from '@prisma/client'
import { safeDecrypt } from '@/lib/utils/crypto'

// GET /api/platform/users?page=1&q=keyword
export async function GET(req: NextRequest) {
  const auth = await requirePlatformAuth(req)
  if (auth instanceof NextResponse) return auth

  const page = parseInt(req.nextUrl.searchParams.get('page') ?? '1')
  const q = req.nextUrl.searchParams.get('q') ?? ''
  const pageSize = 20

  // SUPER_ADMIN 可透過 query param 指定要查哪個 Platform Admin
  const tenantAdminId = auth.role === 'SUPER_ADMIN'
    ? (req.nextUrl.searchParams.get('tenantAdminId') || null)
    : auth.tenantAdminId
  const tenantWhere: Prisma.UserWhereInput = tenantAdminId ? { tenantAdminId } : {}

  const where: Prisma.UserWhereInput = q
    ? {
        AND: [
          tenantWhere,
          {
            OR: [
              { displayName: { contains: q, mode: 'insensitive' as const } },
              { lineUid: { contains: q } },
            ],
          },
        ],
      }
    : tenantWhere

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        lineUid: true,
        displayName: true,
        avatarUrl: true,
        phone: true,
        email: true,
        createdAt: true,
        tenantAdmin: { select: { id: true, name: true, brandName: true } },
        groupMembership: { select: { group: { select: { name: true } } } },
        ownedGroup: { select: { name: true, status: true } },
        _count: { select: { orders: true, coupons: true } },
      },
    }),
    prisma.user.count({ where }),
  ])

  const usersDecrypted = users.map(u => ({
    ...u,
    phone: u.phone ? safeDecrypt(u.phone) : u.phone,
    email: u.email ? safeDecrypt(u.email) : u.email,
  }))

  return NextResponse.json({ users: usersDecrypted, total, page, pageSize })
}
