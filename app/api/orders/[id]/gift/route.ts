import { NextRequest, NextResponse } from 'next/server'
import { verifySession, SESSION_COOKIE } from '@/lib/auth/session'
import { createGift, cancelGift } from '@/lib/services/gift'

async function auth(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value
  if (!token) return null
  try { return await verifySession(token) } catch { return null }
}

// POST /api/orders/[id]/gift  — sender 建立分享連結
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const r = await createGift(id, session.userId)
  if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 422 })

  return NextResponse.json({ ok: true, token: r.token, expiresAt: r.expiresAt.toISOString() })
}

// DELETE /api/orders/[id]/gift  — sender 取消分享
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const r = await cancelGift(id, session.userId)
  if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 422 })

  return NextResponse.json({ ok: true })
}
