import { NextRequest, NextResponse } from 'next/server'
import { verifySession, SESSION_COOKIE } from '@/lib/auth/session'
import { getOrderByIdForUser, markOrderProcessing, markOrderPaid, markOrderFailed, markOrderCancelled, isOrderExpired } from '@/lib/services/order'
import { tapPayCharge, tapPayChargeByToken } from '@/lib/services/tappay'
import { triggerEsimActivation } from '@/lib/services/esim'
import { calculateAndSaveCommission } from '@/lib/services/commission'
import { issueRepurchaseCouponForOrder } from '@/lib/services/coupon'
import { getUserById } from '@/lib/services/user'
import { notifyOrderPaid } from '@/lib/services/notification'
import { prisma } from '@/lib/db/prisma'
import { decrypt } from '@/lib/utils/crypto'
import { OrderStatus } from '@prisma/client'

// POST /api/payment/tappay
// Body: { orderId, prime?, useToken?, remember?, returnUrl? }
export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let session
  try { session = await verifySession(token) } catch {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
  }

  const body = await req.json()
  const { orderId, prime, useToken, remember, returnUrl } = body as {
    orderId?: string
    prime?: string
    useToken?: boolean
    remember?: boolean
    returnUrl?: string
  }

  if (!orderId) return NextResponse.json({ error: 'orderId 必填' }, { status: 400 })
  if (!prime && !useToken) return NextResponse.json({ error: 'prime 或 useToken 擇一必填' }, { status: 400 })

  const order = await getOrderByIdForUser(orderId, session.userId)
  if (!order) return NextResponse.json({ error: '訂單不存在' }, { status: 404 })
  if (order.status !== OrderStatus.PENDING) {
    return NextResponse.json({ error: '訂單已不在待付款狀態' }, { status: 409 })
  }

  // 逾時檢查：建立超過 30 分鐘自動取消
  if (isOrderExpired(order.createdAt)) {
    await markOrderCancelled(orderId)
    return NextResponse.json({ error: '訂單已逾時取消（超過 30 分鐘），請重新下單' }, { status: 410 })
  }

  const user = await getUserById(session.userId)
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const tapPayOrderId = order.orderNumber ?? `ESM-${orderId.slice(-8).toUpperCase()}`
  await markOrderProcessing(orderId, tapPayOrderId)

  const productName = order.orderItems[0]?.productName ?? 'eSIM'
  const cardholder = {
    phone_number: user.phone ?? '',
    name: user.displayName ?? '',
    email: user.email ?? '',
  }

  // Build 3DS result URLs if returnUrl provided
  const origin = req.nextUrl.origin
  const frontendRedirectUrl = returnUrl ?? `${origin}/orders/${orderId}`
  const backendNotifyUrl = `${origin}/api/payment/tappay/notify`
  const resultUrl = { frontendRedirectUrl, backendNotifyUrl }

  let charge
  if (useToken) {
    const saved = await prisma.savedCard.findUnique({ where: { userId: session.userId } })
    if (!saved) {
      await markOrderFailed(orderId)
      return NextResponse.json({ error: '未找到儲存卡片，請重新輸入卡號' }, { status: 400 })
    }
    charge = await tapPayChargeByToken(
      {
        cardKey: decrypt(saved.cardKeyEnc),
        cardToken: decrypt(saved.cardTokenEnc),
        orderId: tapPayOrderId,
        amount: order.totalPaid,
        details: productName,
        cardholder,
        resultUrl,
      },
      user.tenantAdminId,
    )
  } else {
    charge = await tapPayCharge(
      {
        prime: prime!,
        orderId: tapPayOrderId,
        amount: order.totalPaid,
        details: productName,
        cardholder,
        remember: remember ?? false,
        resultUrl,
      },
      user.tenantAdminId,
    )
  }

  if (!charge.ok) {
    await markOrderFailed(orderId)
    return NextResponse.json({ error: charge.message }, { status: 402 })
  }

  // 3DS redirect — payment will be confirmed via webhook
  if (charge.paymentUrl) {
    return NextResponse.json({ requiresRedirect: true, paymentUrl: charge.paymentUrl, orderId })
  }

  // Non-3DS path: mark paid immediately and trigger downstream
  await markOrderPaid(orderId, charge.recTradeId)

  triggerEsimActivation(orderId).catch(() => {})
  calculateAndSaveCommission(orderId).catch(() => {})
  issueRepurchaseCouponForOrder(orderId).catch(() => {})
  notifyOrderPaid(session.userId, productName, order.totalPaid).catch(() => {})

  return NextResponse.json({ ok: true, orderId })
}
