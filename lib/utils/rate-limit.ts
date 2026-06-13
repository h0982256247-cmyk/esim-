import { prisma } from '@/lib/db/prisma'

// DB-backed 固定視窗限流（serverless 跨實例有效；不需 Redis）。
// fail-open：限流器自身出錯一律放行，絕不可因限流 bug 擋住正常付款/下單。
// 視窗起點併入 bucket key，舊 bucket 由 cleanupRateLimits()（cron）清掉。
export async function checkRateLimit(key: string, limit: number, windowSec: number): Promise<boolean> {
  try {
    const windowStart = Math.floor(Date.now() / (windowSec * 1000)) * windowSec
    const bucket = `${key}:${windowStart}`
    const rows = await prisma.$queryRaw<Array<{ count: number }>>`
      INSERT INTO rate_limits (bucket, count, window_start)
      VALUES (${bucket}, 1, to_timestamp(${windowStart}))
      ON CONFLICT (bucket) DO UPDATE SET count = rate_limits.count + 1
      RETURNING count`
    return (rows[0]?.count ?? 0) <= limit
  } catch {
    return true // fail-open
  }
}

// 取請求來源 IP（Vercel 走 x-forwarded-for）；取不到回 'unknown'
export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for')
  return (xff ? xff.split(',')[0]?.trim() : '') || req.headers.get('x-real-ip') || 'unknown'
}
