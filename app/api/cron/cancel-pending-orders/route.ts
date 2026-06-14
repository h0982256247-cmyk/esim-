import { NextRequest, NextResponse } from 'next/server'
import { cancelExpiredPendingOrders } from '@/lib/services/order'
import { cleanupRateLimits } from '@/lib/utils/rate-limit'

// GET /api/cron/cancel-pending-orders
// 每日由 Vercel Cron 呼叫（Hobby 方案 cron 上限為每日一次），取消超過 30 分鐘的
// PENDING 訂單；逾時即時取消另由付款流程 isOrderExpired 把關，此 cron 為後備清理。
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
  // 順帶清掉過期限流視窗，避免 rate_limits 無上限增長（清理失敗不影響主工作）
  const rateLimitsPruned = await cleanupRateLimits()
  return NextResponse.json({ ok: true, cancelled, rateLimitsPruned, at: new Date().toISOString() })
}
