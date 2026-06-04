import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAuth } from '@/lib/auth/platform'
import { adminSetRebateRate } from '@/lib/services/group'

type Params = { params: Promise<{ id: string }> }

// PATCH /api/admin/groups/:id — 設定讓利比例（受 maxRebateRate 限制）
export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requirePlatformAuth(req)
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const { rebateRate } = await req.json()

  if (typeof rebateRate !== 'number') {
    return NextResponse.json({ error: '請提供 rebateRate' }, { status: 400 })
  }

  try {
    await adminSetRebateRate(id, rebateRate, auth.tenantAdminId)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 })
  }
}
