import { NextRequest, NextResponse } from 'next/server'
import { cancelExpiredPendingOrders } from '@/lib/services/order'

// GET /api/cron/cancel-pending-orders
// 每 5 分鐘由 Vercel Cron 呼叫，取消超過 30 分鐘的 PENDING 訂單
// 驗證方式：Vercel 自動帶 Authorization: Bearer {CRON_SECRET}
export async function GET(req: NextRequest) {
  // Fail-closed：未設定 CRON_SECRET 一律拒絕（先前未設定時端點完全公開，任何人可觸發）
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET 未設定，拒絕執行' }, { status: 503 })
  }
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const cancelled = await cancelExpiredPendingOrders()
  return NextResponse.json({ ok: true, cancelled, at: new Date().toISOString() })
}
