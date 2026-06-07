import { NextRequest, NextResponse } from 'next/server'
import { verifySession, SESSION_COOKIE } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { triggerEsimRedemption } from '@/lib/services/esim'

// POST /api/orders/[id]/redeem
// 用戶按下「我要安裝」時呼叫。觸發 WM 3.1 兌換，3.2 callback 之後 QR/LPA 才會出現在訂單上。
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = req.cookies.get(SESSION_COOKIE)?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let session
  try { session = await verifySession(token) } catch {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
  }

  const { id } = await params
  const order = await prisma.order.findUnique({
    where: { id },
    select: { id: true, currentOwnerId: true },
  })
  if (!order) return NextResponse.json({ error: '訂單不存在' }, { status: 404 })
  if (order.currentOwnerId !== session.userId) {
    return NextResponse.json({ error: '你不是此訂單的擁有者' }, { status: 403 })
  }

  const r = await triggerEsimRedemption(id)
  if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 422 })

  return NextResponse.json({ ok: true })
}
