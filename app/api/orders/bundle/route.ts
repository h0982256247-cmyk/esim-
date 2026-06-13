import { NextRequest, NextResponse } from 'next/server'
import { verifySession, SESSION_COOKIE } from '@/lib/auth/session'
import { createBundleOrders, type BundleCartLine } from '@/lib/services/order'
import { isUserProfileComplete } from '@/lib/services/user'
import { PaymentMethod } from '@prisma/client'

// 多品項結帳要逐筆寫入 N 張訂單，走 PgBouncer 的遠端連線一多就超過 Vercel
// 預設 10 秒 function timeout（拋例外 → 回傳 500 HTML → 前端 .json() 解析失敗
// → 顯示「網路錯誤，請重試」）。比照 CSV 匯入拉到 60 秒。
export const maxDuration = 60

// POST /api/orders/bundle — 多品項一次結帳
// Body: { lines: [{ productId, qty }], paymentMethod }
export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let session
  try { session = await verifySession(token) } catch {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
  }

  let body: { lines?: BundleCartLine[]; paymentMethod?: PaymentMethod; couponIds?: string[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: '請求格式錯誤' }, { status: 400 })
  }
  const { lines, paymentMethod } = body
  const couponIds = Array.isArray(body.couponIds) ? body.couponIds.filter(x => typeof x === 'string') : []

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

  // 結帳前需完成基本資料（姓名/手機/Email/生日）
  if (!(await isUserProfileComplete(session.userId))) {
    return NextResponse.json({ error: '請先完成基本資料填寫', code: 'PROFILE_INCOMPLETE' }, { status: 422 })
  }

  // Wrap the service call so an unexpected DB/transaction throw still returns
  // JSON (not a 500 HTML page). A non-JSON 500 makes the client's .json()
  // throw and surfaces a misleading「網路錯誤，請重試」.
  try {
    const result = await createBundleOrders({
      userId: session.userId,
      lineUid: session.lineUid,
      lines: cleaned,
      paymentMethod,
      couponIds,
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.reason }, { status: 422 })
    }

    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : '建立訂單失敗，請稍後再試'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
