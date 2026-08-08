import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAuth } from '@/lib/auth/platform'
import { getAllPendingCommissions, getAllSettlementsForAdmin } from '@/lib/services/commission'

// GET /api/admin/commissions — 待結算分潤 + 各社群結算應付總覽
export async function GET(req: NextRequest) {
  const auth = await requirePlatformAuth(req)
  if (auth instanceof NextResponse) return auth

  const tenantAdminId = auth.role === 'SUPER_ADMIN'
    ? (req.nextUrl.searchParams.get('tenantAdminId') || null)
    : auth.tenantAdminId

  const [commissions, settlements] = await Promise.all([
    getAllPendingCommissions(tenantAdminId),
    getAllSettlementsForAdmin(tenantAdminId),
  ])
  return NextResponse.json({ commissions, settlements })
}
