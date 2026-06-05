import { NextRequest, NextResponse } from 'next/server'
import { verifySession, SESSION_COOKIE } from '@/lib/auth/session'
import { getOrderByIdForUser, markOrderCancelled, isOrderExpired } from '@/lib/services/order'
import { OrderStatus } from '@prisma/client'

// GET /api/orders/:id — 訂單詳情（PENDING 逾時自動取消）
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = req.cookies.get(SESSION_COOKIE)?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let session
  try { session = await verifySession(token) } catch {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
  }

  const { id } = await params
  const order = await getOrderByIdForUser(id, session.userId)

  if (!order) return NextResponse.json({ error: '訂單不存在' }, { status: 404 })

  // 懶取消：PENDING 超過 30 分鐘靜默取消
  if (order.status === OrderStatus.PENDING && isOrderExpired(order.createdAt)) {
    await markOrderCancelled(id)
    return NextResponse.json({ order: { ...order, status: 'CANCELLED' } })
  }

  return NextResponse.json({ order })
}
