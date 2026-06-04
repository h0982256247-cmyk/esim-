import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAuth } from '@/lib/auth/platform'
import { prisma } from '@/lib/db/prisma'
import { Prisma, PlatformAdminRole, OrderStatus, CommissionStatus, GroupStatus } from '@prisma/client'

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requirePlatformAuth(req)
  if (auth instanceof NextResponse) return auth
  if (auth.role !== PlatformAdminRole.SUPER_ADMIN) {
    return NextResponse.json({ error: '權限不足' }, { status: 403 })
  }

  const { id: tenantAdminId } = await params

  const userWhere: Prisma.UserWhereInput = {
    OR: [
      { groupMembership: { group: { tenantAdminId } } },
      { ownedGroup: { tenantAdminId } },
    ],
  }

  const orderWhere: Prisma.OrderWhereInput = {
    user: {
      OR: [
        { groupMembership: { group: { tenantAdminId } } },
        { ownedGroup: { tenantAdminId } },
      ],
    },
  }

  const [
    totalUsers,
    totalOrders,
    paidOrders,
    pendingGroups,
    approvedGroups,
    pendingCommissions,
    esimPendingOrders,
  ] = await Promise.all([
    prisma.user.count({ where: userWhere }),
    prisma.order.count({ where: orderWhere }),
    prisma.order.aggregate({
      where: { ...orderWhere, status: { in: [OrderStatus.PAID, OrderStatus.COMPLETED] } },
      _sum: { totalPaid: true },
    }),
    prisma.group.count({ where: { status: GroupStatus.PENDING, tenantAdminId } }),
    prisma.group.count({ where: { status: GroupStatus.APPROVED, tenantAdminId } }),
    prisma.commission.aggregate({
      where: { status: CommissionStatus.PENDING, group: { tenantAdminId } },
      _sum: { commissionAmount: true },
    }),
    prisma.order.count({ where: { ...orderWhere, status: OrderStatus.ESIM_PENDING } }),
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
