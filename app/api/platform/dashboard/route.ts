import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAuth } from '@/lib/auth/platform'
import { getDashboardStats } from '@/lib/services/platform-admin'
import { prisma } from '@/lib/db/prisma'

export async function GET(req: NextRequest) {
  const auth = await requirePlatformAuth(req)
  if (auth instanceof NextResponse) return auth

  try {
    const stats = await getDashboardStats(auth.tenantAdminId)
    return NextResponse.json(stats)
  } catch (e) {
    // 暫時診斷：把真實錯誤寫到 system_alerts（可用 SQL 讀）＋回傳前端，釐清後移除。
    const message = e instanceof Error ? e.message : String(e)
    const stack = e instanceof Error ? (e.stack ?? '') : ''
    try {
      await prisma.$executeRaw`
        INSERT INTO system_alerts (label, context)
        VALUES ('dashboard_debug', ${JSON.stringify({ message, stack: stack.slice(0, 4000) })}::jsonb)`
    } catch { /* 寫入失敗也別讓診斷再丟錯 */ }
    return NextResponse.json(
      { error: message, detail: stack.split('\n').slice(0, 6).join('\n') },
      { status: 500 },
    )
  }
}
