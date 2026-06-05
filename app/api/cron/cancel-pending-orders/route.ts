import { NextRequest, NextResponse } from 'next/server'
import { cancelExpiredPendingOrders } from '@/lib/services/order'

// GET /api/cron/cancel-pending-orders
// 每 5 分鐘由 Vercel Cron 呼叫，取消超過 30 分鐘的 PENDING 訂單
// 驗證方式：Vercel 自動帶 Authorization: Bearer {CRON_SECRET}
export async function GET(req: NextRequest) {
  // 若設定了 CRON_SECRET 則驗證，未設定時僅允許本機呼叫
  if (process.env.CRON_SECRET) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const cancelled = await cancelExpiredPendingOrders()
  return NextResponse.json({ ok: true, cancelled, at: new Date().toISOString() })
}
