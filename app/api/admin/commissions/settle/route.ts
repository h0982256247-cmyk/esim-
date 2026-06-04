import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAuth } from '@/lib/auth/platform'
import { settleCommissions } from '@/lib/services/commission'

// POST /api/admin/commissions/settle
// Body: { groupId, period }  period = "YYYY-MM"
export async function POST(req: NextRequest) {
  const auth = await requirePlatformAuth(req)
  if (auth instanceof NextResponse) return auth

  const { groupId, period } = await req.json()

  if (!groupId || !period || !/^\d{4}-\d{2}$/.test(period)) {
    return NextResponse.json({ error: 'groupId 與 period (YYYY-MM) 必填' }, { status: 400 })
  }

  await settleCommissions(groupId, period)
  return NextResponse.json({ ok: true })
}
