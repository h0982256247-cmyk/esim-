import { NextRequest, NextResponse } from 'next/server'
import { verifySession, SESSION_COOKIE } from '@/lib/auth/session'
import { createBundleOrders, type BundleCartLine } from '@/lib/services/order'
import { PaymentMethod } from '@prisma/client'

// POST /api/orders/bundle — 多品項一次結帳
// Body: { lines: [{ productId, qty }], paymentMethod }
export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let session
  try { session = await verifySession(token) } catch {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
  }

  const body = await req.json()
  const { lines, paymentMethod } = body as { lines?: BundleCartLine[]; paymentMethod?: PaymentMethod }

  if (!Array.isArray(lines) || lines.length === 0) {
    return NextResponse.json({ error: 'lines 必填' }, { status: 400 })
  }
  if (!paymentMethod || !Object.values(PaymentMethod).includes(paymentMethod)) {
    return NextResponse.json({ error: 'paymentMethod 無效' }, { status: 400 })
  }

  // Sanitize lines — reject obviously malformed input early
  const cleaned: BundleCartLine[] = []
  for (const l of lines) {
    if (!l || typeof l.productId !== 'string') {
      return NextResponse.json({ error: '商品資料格式錯誤' }, { status: 400 })
    }
    cleaned.push({ productId: l.productId, qty: Math.max(1, Math.min(9, Math.floor(Number(l.qty) || 1))) })
  }

  const result = await createBundleOrders({
    userId: session.userId,
    lineUid: session.lineUid,
    lines: cleaned,
    paymentMethod,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 422 })
  }

  return NextResponse.json(result, { status: 201 })
}
