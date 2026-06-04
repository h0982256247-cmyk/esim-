import { NextRequest, NextResponse } from 'next/server'
import { verifySession, SESSION_COOKIE } from '@/lib/auth/session'
import { applyGroup, getGroupByOwnerId, getUserGroup } from '@/lib/services/group'

// GET /api/groups — 取得當前使用者的社群資訊（群主或群員）
export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let session
  try { session = await verifySession(token) } catch {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
  }

  const [ownedGroup, membership] = await Promise.all([
    getGroupByOwnerId(session.userId),
    getUserGroup(session.userId),
  ])

  return NextResponse.json({ ownedGroup, membership })
}

// POST /api/groups — 申請成立社群
export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let session
  try { session = await verifySession(token) } catch {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
  }

  const { name, description, type } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'name 必填' }, { status: 400 })

  try {
    const group = await applyGroup({ userId: session.userId, name, description, type })
    return NextResponse.json({ group }, { status: 201 })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '申請失敗' }, { status: 422 })
  }
}
