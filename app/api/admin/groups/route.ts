import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAuth } from '@/lib/auth/platform'
import { getAllGroups } from '@/lib/services/group'
import { GroupStatus } from '@prisma/client'

// GET /api/admin/groups?status=PENDING
export async function GET(req: NextRequest) {
  const auth = await requirePlatformAuth(req)
  if (auth instanceof NextResponse) return auth

  const statusParam = req.nextUrl.searchParams.get('status')
  const status = statusParam && Object.values(GroupStatus).includes(statusParam as GroupStatus)
    ? (statusParam as GroupStatus)
    : undefined

  const groups = await getAllGroups(status)
  return NextResponse.json({ groups })
}
