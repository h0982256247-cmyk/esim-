import { NextRequest, NextResponse } from 'next/server'
import { retryStuckEsimActivations } from '@/lib/services/esim'

// GET /api/cron/retry-esim-activation
// 由 Vercel Cron 定期呼叫，重試「已付款卻還沒拿到 eSIM」的訂單（placeWmOrder
// 瞬時失敗留下的 PAID-無 esimRcode 單）。以 retryCount 設上限，達上限留待人工補發。
// 驗證方式：Vercel 自動帶 Authorization: Bearer {CRON_SECRET}。
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET 未設定，拒絕執行' }, { status: 503 })
  }
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await retryStuckEsimActivations()
  return NextResponse.json({ ok: true, ...result, at: new Date().toISOString() })
}
