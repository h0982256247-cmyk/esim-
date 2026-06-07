import { NextRequest, NextResponse } from 'next/server'
import { cancelExpiredGifts } from '@/lib/services/gift'

// GET /api/cron/cancel-expired-gifts
// 每日由 Vercel Cron 呼叫，自動取消過期未領取的 OrderGift
export async function GET(req: NextRequest) {
  if (process.env.CRON_SECRET) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const cancelled = await cancelExpiredGifts()
  return NextResponse.json({ ok: true, cancelled, at: new Date().toISOString() })
}
