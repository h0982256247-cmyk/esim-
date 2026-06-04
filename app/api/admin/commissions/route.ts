import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAuth } from '@/lib/auth/platform'
import { getAllPendingCommissions } from '@/lib/services/commission'

// GET /api/admin/commissions — 所有待結算分潤
export async function GET(req: NextRequest) {
  const auth = await requirePlatformAuth(req)
  if (auth instanceof NextResponse) return auth

  const commissions = await getAllPendingCommissions(auth.tenantAdminId)
  return NextResponse.json({ commissions })
}
