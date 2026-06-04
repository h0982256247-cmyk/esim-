import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAuth } from '@/lib/auth/platform'
import { prisma } from '@/lib/db/prisma'
import { retryEsimActivation } from '@/lib/services/esim'
import { cancelCommission } from '@/lib/services/commission'
import { OrderStatus } from '@prisma/client'

type Params = { params: Promise<{ id: string }> }

// GET /api/platform/orders/:id
export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requirePlatformAuth(req)
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      user: { select: { displayName: true, lineUid: true, phone: true, email: true } },
      orderItems: true,
      orderCoupons: { include: { coupon: { select: { type: true, discount: true } } } },
      commission: true,
    },
  })

  if (!order) return NextResponse.json({ error: '訂單不存在' }, { status: 404 })
  return NextResponse.json({ order })
}

// PATCH /api/platform/orders/:id  — action: retry_esim | refund
export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requirePlatformAuth(req)
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const { action } = await req.json()

  if (action === 'retry_esim') {
    const order = await prisma.order.findUnique({ where: { id }, select: { status: true } })
    if (!order) return NextResponse.json({ error: '訂單不存在' }, { status: 404 })
    if (order.status !== OrderStatus.ESIM_PENDING) {
      return NextResponse.json({ error: '只有 ESIM_PENDING 狀態可補發' }, { status: 409 })
    }
    retryEsimActivation(id).catch(() => {})
    return NextResponse.json({ ok: true, message: '已觸發補發流程' })
  }

  if (action === 'refund') {
    await prisma.order.update({
      where: { id },
      data: { status: OrderStatus.REFUNDED },
    })
    await cancelCommission(id)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'action 無效' }, { status: 400 })
}
