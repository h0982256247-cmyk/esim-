import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAuth } from '@/lib/auth/platform'
import { getDashboardStats } from '@/lib/services/platform-admin'

export async function GET(req: NextRequest) {
  const auth = await requirePlatformAuth(req)
  if (auth instanceof NextResponse) return auth

  const stats = await getDashboardStats(auth.tenantAdminId)
  return NextResponse.json(stats)
}
