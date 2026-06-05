import { NextRequest, NextResponse } from 'next/server'
import { verifySession, SESSION_COOKIE } from '@/lib/auth/session'
import { prisma } from '@/lib/db/prisma'

// GET /api/groups/stats — 社群主專用：回傳會員數、分潤金額
export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let session
  try { session = await verifySession(token) } catch {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
  }

  const group = await prisma.group.findUnique({
    where: { ownerId: session.userId },
    select: { id: true },
  })

  if (!group) return NextResponse.json({ error: 'Not a group owner' }, { status: 403 })

  const [memberCount, pending, settled, recentCommissions] = await Promise.all([
    prisma.groupMember.count({
      where: { groupId: group.id, leftAt: null },
    }),
    prisma.commission.aggregate({
      where: { groupId: group.id, status: 'PENDING' },
      _sum: { commissionAmount: true },
    }),
    prisma.commission.aggregate({
      where: { groupId: group.id, status: 'SETTLED' },
      _sum: { commissionAmount: true },
    }),
    prisma.commission.findMany({
      where: { groupId: group.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        commissionAmount: true,
        status: true,
        createdAt: true,
        order: { select: { totalPaid: true } },
      },
    }),
  ])

  return NextResponse.json({
    memberCount,
    pendingAmount: pending._sum.commissionAmount ?? 0,
    settledAmount: settled._sum.commissionAmount ?? 0,
    recentCommissions: recentCommissions.map(c => ({
      id: c.id,
      amount: c.commissionAmount,
      status: c.status,
      createdAt: c.createdAt.toISOString(),
      orderTotal: c.order.totalPaid,
    })),
  })
}
