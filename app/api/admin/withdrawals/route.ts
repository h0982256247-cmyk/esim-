import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAuth } from '@/lib/auth/platform'
import { getAllWithdrawalsForAdmin } from '@/lib/services/withdrawal'

// GET /api/admin/withdrawals — admin 查所有提領申請（tenant-scoped）
export async function GET(req: NextRequest) {
  const auth = await requirePlatformAuth(req)
  if (auth instanceof NextResponse) return auth

  const tenantAdminId = auth.role === 'PLATFORM_ADMIN' ? auth.tenantAdminId
    : auth.role === 'SUB_ADMIN' ? auth.tenantAdminId
    : null  // SUPER_ADMIN sees all

  const withdrawals = await getAllWithdrawalsForAdmin(tenantAdminId)
  return NextResponse.json({ withdrawals })
}
