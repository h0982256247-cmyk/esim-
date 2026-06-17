import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAuth } from '@/lib/auth/platform'
import { prisma } from '@/lib/db/prisma'
import { Prisma, OrderStatus } from '@prisma/client'

// GET /api/platform/orders?page=1&status=PENDING（待付款涵蓋 PENDING+PROCESSING）
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

  // 待付款 filter（status=PENDING）需同時涵蓋 PENDING（建立中）與 PROCESSING
  // （金流進行中／已送出尚未收到 backend notify）——兩者前台皆顯示「待付款」。
  const statusWhere: Prisma.OrderWhereInput =
    statusParam === OrderStatus.PENDING
      ? { status: { in: [OrderStatus.PENDING, OrderStatus.PROCESSING] } }
      : statusParam && Object.values(OrderStatus).includes(statusParam as OrderStatus)
        ? { status: statusParam as OrderStatus }
        : {}

  // 搜尋：訂單編號 或 會員暱稱（Email 已加密無法比對，故不納入）
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim()
  const searchWhere: Prisma.OrderWhereInput = q ? {
    OR: [
      { orderNumber: { contains: q, mode: 'insensitive' } },
      { user: { displayName: { contains: q, mode: 'insensitive' } } },
    ],
  } : {}

  const where: Prisma.OrderWhereInput = {
    ...statusWhere,
    ...tenantWhere,
    ...searchWhere,
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        totalPaid: true,
        subtotal: true,
        discountAmount: true,
        paymentMethod: true,
        tapPayOrderId: true,
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
