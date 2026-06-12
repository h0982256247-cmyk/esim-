import { NextRequest, NextResponse } from 'next/server'
import { verifySession, SESSION_COOKIE } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'
import { encrypt } from '@/lib/utils/crypto'

// PATCH /api/groups/settings — 社群主更新讓利比例 / 基本設定
export async function PATCH(req: NextRequest) {
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
    return NextResponse.json({ error: '無社群主權限或社群尚未核准' }, { status: 403 })
  }

  const body = await req.json()
  const updates: Record<string, unknown> = {}

  if (typeof body.rebateRate === 'number') {
    if (body.rebateRate < 0 || body.rebateRate > 0.3) {
      return NextResponse.json({ error: '讓利比例須介於 0 ~ 0.30' }, { status: 400 })
    }
    updates.rebateRate = body.rebateRate
  }

  // 銀行欄位加密儲存（bankName 為公開資訊不加密）
  if (body.bankName !== undefined) updates.bankName = body.bankName
  if (body.bankAccount !== undefined)    updates.bankAccount    = body.bankAccount    ? encrypt(body.bankAccount)    : null
  if (body.bankBranch !== undefined)     updates.bankBranch     = body.bankBranch     ? encrypt(body.bankBranch)     : null
  if (body.bankHolderName !== undefined) updates.bankHolderName = body.bankHolderName ? encrypt(body.bankHolderName) : null
  if (body.description !== undefined) updates.description = body.description

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: '沒有可更新的欄位' }, { status: 400 })
  }

  const updated = await prisma.group.update({
    where: { id: group.id },
    data: updates,
  })

  return NextResponse.json({ group: updated })
}
