import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAuth } from '@/lib/auth/platform'
import { prisma } from '@/lib/db/prisma'
import { PlatformAdminRole } from '@prisma/client'

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requirePlatformAuth(req)
  if (auth instanceof NextResponse) return auth
  if (auth.role !== PlatformAdminRole.SUPER_ADMIN) {
    return NextResponse.json({ error: '權限不足' }, { status: 403 })
  }

  const { id: tenantAdminId } = await params

  const userTenantWhere = {
    OR: [
      { groupMembership: { group: { tenantAdminId } } },
      { ownedGroup: { tenantAdminId } },
    ],
  } as const

  const orderTenantWhere = {
    user: { OR: [
      { groupMembership: { group: { tenantAdminId } } },
      { ownedGroup: { tenantAdminId } },
    ] },
  } as const

  const [
    totalUsers,
    totalOrders,
    paidOrders,
    pendingGroups,
    approvedGroups,
    pendingCommissions,
    esimPendingOrders,
  ] = await Promise.all([
    prisma.user.count({ where: userTenantWhere }),
    prisma.order.count({ where: orderTenantWhere }),
    prisma.order.aggregate({
      where: { status: { in: ['PAID', 'COMPLETED'] }, ...orderTenantWhere },
      _sum: { totalPaid: true },
    }),
    prisma.group.count({ where: { status: 'PENDING', tenantAdminId } }),
    prisma.group.count({ where: { status: 'APPROVED', tenantAdminId } }),
    prisma.commission.aggregate({
      where: { status: 'PENDING', group: { tenantAdminId } },
      _sum: { commissionAmount: true },
    }),
    prisma.order.count({ where: { status: 'ESIM_PENDING', ...orderTenantWhere } }),
  ])

  return NextResponse.json({
    totalUsers,
    totalOrders,
    totalRevenue: paidOrders._sum.totalPaid ?? 0,
    pendingGroups,
    approvedGroups,
    pendingCommissions: pendingCommissions._sum.commissionAmount ?? 0,
    esimPendingOrders,
  })
}
