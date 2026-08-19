import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAuth } from '@/lib/auth/platform'
import { dissolveGroup } from '@/lib/services/group'

// POST /api/admin/groups/[id]/dissolve
// 解散「全新」社群 → 社群主退回未加入。若已有成員/分潤/結算/提領/用券記錄則擋下（請改用停權）。
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePlatformAuth(req)
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const result = await dissolveGroup(id, auth.tenantAdminId)
  if (!result.ok) {
    const status = result.reason.includes('無權') ? 403 : result.reason.includes('不存在') ? 404 : 422
    return NextResponse.json({ error: result.reason }, { status })
  }
  return NextResponse.json({ ok: true })
}
