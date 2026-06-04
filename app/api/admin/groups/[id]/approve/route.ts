import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAuth } from '@/lib/auth/platform'
import { approveGroup } from '@/lib/services/group'

// POST /api/admin/groups/:id/approve
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePlatformAuth(req)
  if (auth instanceof NextResponse) return auth

  const { id } = await params

  try {
    const group = await approveGroup(id)
    return NextResponse.json({ group })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '審核失敗' }, { status: 422 })
  }
}
