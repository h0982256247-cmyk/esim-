import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { settleCommissions } from '@/lib/services/commission'
import { GroupStatus } from '@prisma/client'

// GET /api/cron/settle-monthly
// 每月 1 號由 Vercel Cron 呼叫，對所有 APPROVED 社群結算「上個月」
// 驗證方式：Vercel 自動帶 Authorization: Bearer {CRON_SECRET}
export async function GET(req: NextRequest) {
  if (process.env.CRON_SECRET) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  // 結算「上個月」（this 月 1 號跑時，結算上月）
  const now = new Date()
  const target = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const period = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}`

  const groups = await prisma.group.findMany({
    where: { status: GroupStatus.APPROVED },
    select: { id: true, name: true },
  })

  let settled = 0
  const errors: { groupName: string; error: string }[] = []

  for (const g of groups) {
    try {
      await settleCommissions(g.id, period)
      settled++
    } catch (err) {
      errors.push({ groupName: g.name, error: err instanceof Error ? err.message : 'unknown' })
    }
  }

  return NextResponse.json({
    ok: true,
    period,
    totalGroups: groups.length,
    settled,
    errors,
    at: new Date().toISOString(),
  })
}
