import { NextRequest, NextResponse } from 'next/server'
import { verifySession, SESSION_COOKIE } from '@/lib/auth/session'
import { createOrder, getUserOrders } from '@/lib/services/order'
import { PaymentMethod } from '@prisma/client'

// GET /api/orders — 我的訂單列表
export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let session
  try { session = await verifySession(token) } catch {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
  }

  const orders = await getUserOrders(session.userId)
  return NextResponse.json({ orders })
}

// POST /api/orders — 建立訂單
// Body: { productId, couponIds?, paymentMethod }
export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let session
  try { session = await verifySession(token) } catch {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
  }

  const body = await req.json()
  const { productId, couponIds = [], paymentMethod } = body

  if (!productId) return NextResponse.json({ error: 'productId 必填' }, { status: 400 })
  if (!Object.values(PaymentMethod).includes(paymentMethod)) {
    return NextResponse.json({ error: 'paymentMethod 無效' }, { status: 400 })
  }

  const result = await createOrder({
    userId: session.userId,
    lineUid: session.lineUid,
    productId,
    couponIds,
    paymentMethod,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 422 })
  }

  return NextResponse.json(result, { status: 201 })
}
