import { NextRequest, NextResponse } from 'next/server'
import { verifySession, SESSION_COOKIE } from '@/lib/auth/session'
import { getOrderByIdForUser } from '@/lib/services/order'

// GET /api/orders/:id — 訂單詳情
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

  return NextResponse.json({ order })
}
