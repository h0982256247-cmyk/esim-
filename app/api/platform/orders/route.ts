import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAuth } from '@/lib/auth/platform'
import { prisma } from '@/lib/db/prisma'
import { Prisma, OrderStatus } from '@prisma/client'

// GET /api/platform/orders?page=1&status=ESIM_PENDING
export async function GET(req: NextRequest) {
  const auth = await requirePlatformAuth(req)
  if (auth instanceof NextResponse) return auth

  const page = parseInt(req.nextUrl.searchParams.get('page') ?? '1')
  const statusParam = req.nextUrl.searchParams.get('status')
  const pageSize = 20

  const tenantAdminId = auth.role === 'SUPER_ADMIN'
    ? (req.nextUrl.searchParams.get('tenantAdminId') || null)
    : auth.tenantAdminId
  const tenantWhere: Prisma.OrderWhereInput = tenantAdminId ? {
    user: { tenantAdminId },
  } : {}

  const where: Prisma.OrderWhereInput = {
    ...(statusParam && Object.values(OrderStatus).includes(statusParam as OrderStatus)
      ? { status: statusParam as OrderStatus }
      : {}),
    ...tenantWhere,
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        status: true,
        totalPaid: true,
        subtotal: true,
        discountAmount: true,
        paymentMethod: true,
        paidAt: true,
        createdAt: true,
        retryCount: true,
        user: { select: { displayName: true, lineUid: true } },
        orderItems: { select: { productName: true } },
      },
    }),
    prisma.order.count({ where }),
  ])

  return NextResponse.json({ orders, total, page, pageSize })
}
