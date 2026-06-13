import { NextRequest, NextResponse } from 'next/server'
import { verifySession, SESSION_COOKIE } from '@/lib/auth/session'
import { createOrder, getUserOrders } from '@/lib/services/order'
import { isUserProfileComplete } from '@/lib/services/user'
import { checkRateLimit } from '@/lib/utils/rate-limit'
import { PaymentMethod } from '@prisma/client'

// GET /api/orders — 我的訂單列表
export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let session
  try { session = await verifySession(token) } catch {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
  }

  const orders = await getUserOrders(session.userId)
  return NextResponse.json({ orders })
}

// POST /api/orders — 建立訂單
// Body: { productId, couponIds?, paymentMethod }
export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let session
  try { session = await verifySession(token) } catch {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
  }

  // 限流：同一使用者短時間內過多建單請求 → 擋（防濫用）。fail-open。
  if (!(await checkRateLimit(`order:${session.userId}`, 30, 60))) {
    return NextResponse.json({ error: '操作過於頻繁，請稍後再試' }, { status: 429 })
  }

  const body = await req.json()
  const { productId, couponIds = [], paymentMethod } = body

  if (!productId) return NextResponse.json({ error: 'productId 必填' }, { status: 400 })
  if (!Object.values(PaymentMethod).includes(paymentMethod)) {
    return NextResponse.json({ error: 'paymentMethod 無效' }, { status: 400 })
  }

  // 結帳前需完成基本資料（姓名/手機/Email/生日）
  if (!(await isUserProfileComplete(session.userId))) {
    return NextResponse.json({ error: '請先完成基本資料填寫', code: 'PROFILE_INCOMPLETE' }, { status: 422 })
  }

  const result = await createOrder({
    userId: session.userId,
    lineUid: session.lineUid,
    productId,
    couponIds,
    paymentMethod,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 422 })
  }

  return NextResponse.json(result, { status: 201 })
}
