import { NextRequest, NextResponse } from 'next/server'
import { verifySession, SESSION_COOKIE } from '@/lib/auth/session'
import { getOrderByIdForUser, markOrderProcessing, markOrderPaid, markOrderFailed } from '@/lib/services/order'
import { tapPayCharge } from '@/lib/services/tappay'
import { triggerEsimActivation } from '@/lib/services/esim'
import { calculateAndSaveCommission } from '@/lib/services/commission'
import { getUserById } from '@/lib/services/user'
import { notifyOrderPaid } from '@/lib/services/notification'
import { OrderStatus } from '@prisma/client'

// POST /api/payment/tappay
// Body: { orderId, prime }
export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let session
  try { session = await verifySession(token) } catch {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
  }

  const { orderId, prime } = await req.json()
  if (!orderId || !prime) return NextResponse.json({ error: 'orderId 與 prime 必填' }, { status: 400 })

  const order = await getOrderByIdForUser(orderId, session.userId)
  if (!order) return NextResponse.json({ error: '訂單不存在' }, { status: 404 })
  if (order.status !== OrderStatus.PENDING) {
    return NextResponse.json({ error: '訂單已不在待付款狀態' }, { status: 409 })
  }

  const user = await getUserById(session.userId)
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const tapPayOrderId = `esim_${orderId}_${Date.now()}`
  await markOrderProcessing(orderId, tapPayOrderId)

  const productName = order.orderItems[0]?.productName ?? 'eSIM'
  const charge = await tapPayCharge({
    prime,
    orderId: tapPayOrderId,
    amount: order.totalPaid,
    details: productName,
    cardholder: {
      phone_number: user.phone ?? '',
      name: user.displayName ?? '',
      email: user.email ?? '',
    },
  })

  if (!charge.ok) {
    await markOrderFailed(orderId)
    return NextResponse.json({ error: charge.message }, { status: 402 })
  }

  await markOrderPaid(orderId, charge.recTradeId)

  // 非同步觸發（不阻塞回應）
  triggerEsimActivation(orderId).catch(() => {})
  calculateAndSaveCommission(orderId).catch(() => {})
  notifyOrderPaid(session.userId, productName, order.totalPaid).catch(() => {})

  return NextResponse.json({ ok: true, orderId })
}
