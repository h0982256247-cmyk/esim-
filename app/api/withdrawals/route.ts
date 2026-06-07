import { NextRequest, NextResponse } from 'next/server'
import { verifySession, SESSION_COOKIE } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import {
  requestWithdrawal,
  getWithdrawalsByGroup,
  getWithdrawalBalance,
} from '@/lib/services/withdrawal'

// GET /api/withdrawals — 社群主查自己的提領記錄與餘額
export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let session
  try { session = await verifySession(token) } catch {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
  }

  const group = await prisma.group.findUnique({
    where: { ownerId: session.userId },
    select: { id: true, status: true },
  })
  if (!group || group.status !== 'APPROVED') {
    return NextResponse.json({ error: '無社群主權限' }, { status: 403 })
  }

  const [withdrawals, balance] = await Promise.all([
    getWithdrawalsByGroup(group.id),
    getWithdrawalBalance(group.id),
  ])

  return NextResponse.json({ withdrawals, balance })
}

// POST /api/withdrawals — 社群主申請提領
// Body: { amount }
export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let session
  try { session = await verifySession(token) } catch {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
  }

  const { amount } = await req.json()
  const r = await requestWithdrawal(session.userId, Number(amount))
  if (!r.ok) return NextResponse.json({ error: r.reason }, { status: 422 })

  return NextResponse.json({ ok: true, withdrawalId: r.withdrawalId })
}
