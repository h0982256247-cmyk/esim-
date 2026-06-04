import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAuth } from '@/lib/auth/platform'
import { rejectGroup } from '@/lib/services/group'

// POST /api/admin/groups/:id/reject
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePlatformAuth(req)
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const { note } = await req.json().catch(() => ({}))

  const group = await rejectGroup(id, note)
  return NextResponse.json({ group })
}
