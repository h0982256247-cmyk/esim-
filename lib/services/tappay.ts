// TapPay Pay by Prime / Pay by Token API

import { prisma } from '@/lib/db/prisma'

export interface TapPayChargeInput {
  prime: string
  orderId: string
  amount: number
  details: string
  cardholder: {
    phone_number: string
    name: string
    email: string
  }
  remember?: boolean
  resultUrl?: {
    frontendRedirectUrl: string
    backendNotifyUrl: string
  }
}

export interface TapPayTokenChargeInput {
  cardKey: string
  cardToken: string
  orderId: string
  amount: number
  details: string
  cardholder: {
    phone_number: string
    name: string
    email: string
  }
  resultUrl?: {
    frontendRedirectUrl: string
    backendNotifyUrl: string
  }
}

export type TapPayChargeResult =
  | { ok: true; recTradeId: string; bankTransactionId: string; paymentUrl?: string }
  | { ok: false; message: string }

async function getConfig(tenantAdminId?: string | null, gateway: string = 'tappay_credit') {
  if (tenantAdminId) {
    const cfg = await prisma.tenantPaymentConfig.findFirst({
      where: { adminId: tenantAdminId, gateway, isActive: true },
    })
    if (cfg) {
      return {
        partnerKey: cfg.partnerKey,
        merchantId: cfg.merchantId,
        baseUrl: cfg.env === 'production'
          ? 'https://prod.tappaysdk.com/tpc'
          : 'https://sandbox.tappaysdk.com/tpc',
      }
    }
  }

  const partnerKey = process.env.TAPPAY_PARTNER_KEY
  // LINE Pay 在 TapPay 後台通常是獨立的 merchant_id；未設定時退回信用卡用的 merchant_id
  const merchantId = gateway === 'tappay_linepay'
    ? (process.env.TAPPAY_LINEPAY_MERCHANT_ID ?? process.env.TAPPAY_MERCHANT_ID)
    : process.env.TAPPAY_MERCHANT_ID
  const env = process.env.TAPPAY_ENV === 'production' ? 'production' : 'sandbox'

  if (!partnerKey || !merchantId) throw new Error('TapPay credentials not set')

  const baseUrl = env === 'production'
    ? 'https://prod.tappaysdk.com/tpc'
    : 'https://sandbox.tappaysdk.com/tpc'

  return { partnerKey, merchantId, baseUrl }
}

function build3dsBlock(resultUrl: TapPayChargeInput['resultUrl']) {
  if (!resultUrl) return {}
  return {
    three_domain_secure: {
      enabled: true,
      result_url: {
        frontend_redirect_url: resultUrl.frontendRedirectUrl,
        backend_notify_url: resultUrl.backendNotifyUrl,
      },
    },
  }
}

export async function tapPayCharge(input: TapPayChargeInput, tenantAdminId?: string | null): Promise<TapPayChargeResult> {
  const { partnerKey, merchantId, baseUrl } = await getConfig(tenantAdminId, 'tappay_credit')

  const body = {
    prime: input.prime,
    partner_key: partnerKey,
    merchant_id: merchantId,
    details: input.details,
    amount: input.amount,
    order_number: input.orderId,
    cardholder: input.cardholder,
    remember: input.remember ?? false,
    ...build3dsBlock(input.resultUrl),
  }

  const res = await fetch(`${baseUrl}/payment/pay-by-prime`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': partnerKey,
    },
    body: JSON.stringify(body),
  })

  const data = await res.json()

  if (data.status !== 0) {
    return { ok: false, message: data.msg ?? '付款失敗' }
  }

  return {
    ok: true,
    recTradeId: data.rec_trade_id ?? '',
    bankTransactionId: data.bank_transaction_id ?? '',
    ...(data.payment_url ? { paymentUrl: data.payment_url as string } : {}),
  }
}

export async function tapPayChargeByToken(input: TapPayTokenChargeInput, tenantAdminId?: string | null): Promise<TapPayChargeResult> {
  const { partnerKey, merchantId, baseUrl } = await getConfig(tenantAdminId, 'tappay_credit')

  const body = {
    card_key: input.cardKey,
    card_token: input.cardToken,
    partner_key: partnerKey,
    merchant_id: merchantId,
    details: input.details,
    amount: input.amount,
    order_number: input.orderId,
    cardholder: input.cardholder,
    currency: 'TWD',
    ...build3dsBlock(input.resultUrl),
  }

  const res = await fetch(`${baseUrl}/payment/pay-by-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': partnerKey,
    },
    body: JSON.stringify(body),
  })

  const data = await res.json()

  if (data.status !== 0) {
    return { ok: false, message: data.msg ?? '付款失敗' }
  }

  return {
    ok: true,
    recTradeId: data.rec_trade_id ?? '',
    bankTransactionId: data.bank_transaction_id ?? '',
    ...(data.payment_url ? { paymentUrl: data.payment_url as string } : {}),
  }
}

// ─── Webhook 驗章 ─────────────────────────────────────────────────
// TapPay 未提供 HMAC signature；防偽靠 partner_key header 比對

export async function verifyTapPayWebhook(req: Request, tenantAdminId?: string | null): Promise<boolean> {
  const key = req.headers.get('x-api-key')

  if (tenantAdminId) {
    const cfg = await prisma.tenantPaymentConfig.findFirst({
      where: { adminId: tenantAdminId, gateway: 'tappay_credit', isActive: true },
    })
    if (cfg) {
      return key === cfg.partnerKey
    }
  }

  return key === process.env.TAPPAY_PARTNER_KEY
}

// ─── 退款 ──────────────────────────────────────────────────────────

export async function tapPayRefund(
  recTradeId: string,
  amount: number,
  tenantAdminId?: string | null,
): Promise<{ ok: boolean; message?: string }> {
  const { partnerKey, baseUrl } = await getConfig(tenantAdminId, 'tappay_credit')

  const res = await fetch(`${baseUrl}/transaction/refund`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': partnerKey,
    },
    body: JSON.stringify({
      rec_trade_id: recTradeId,
      amount,
      partner_key: partnerKey,
    }),
  })

  const data = await res.json()
  if (data.status !== 0) return { ok: false, message: data.msg ?? '退款失敗' }
  return { ok: true }
}

// ─── LINE Pay ──────────────────────────────────────────────────────
// TapPay LINE Pay 同樣走 Pay by Prime，但：
//   1. prime 由前端 TPDirect.linePay.getPrime 產生
//   2. result_url 放在「最外層」（與信用卡 3DS 的 three_domain_secure 包法不同）
//   3. merchant_id 通常是 TapPay 後台另開的 LINE Pay 商店代號（gateway = tappay_linepay）
//   4. 一定會回傳 payment_url，前端需導轉至該網址讓使用者於 LINE 完成授權，
//      實際付款結果由 backend_notify_url（/api/payment/tappay/notify）非同步通知。

export interface TapPayLinePayChargeInput {
  prime: string
  orderId: string
  amount: number
  details: string
  cardholder: {
    phone_number: string
    name: string
    email: string
  }
  resultUrl: {
    frontendRedirectUrl: string
    backendNotifyUrl: string
  }
}

export async function tapPayChargeLinePay(
  input: TapPayLinePayChargeInput,
  tenantAdminId?: string | null,
): Promise<TapPayChargeResult> {
  const { partnerKey, merchantId, baseUrl } = await getConfig(tenantAdminId, 'tappay_linepay')

  const body = {
    prime: input.prime,
    partner_key: partnerKey,
    merchant_id: merchantId,
    details: input.details,
    amount: input.amount,
    currency: 'TWD',
    order_number: input.orderId,
    cardholder: input.cardholder,
    // LINE Pay 為導轉型付款，result_url 放最外層
    result_url: {
      frontend_redirect_url: input.resultUrl.frontendRedirectUrl,
      backend_notify_url: input.resultUrl.backendNotifyUrl,
    },
  }

  const res = await fetch(`${baseUrl}/payment/pay-by-prime`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': partnerKey,
    },
    body: JSON.stringify(body),
  })

  const data = await res.json()

  if (data.status !== 0) {
    return { ok: false, message: data.msg ?? 'LINE Pay 付款失敗' }
  }

  // LINE Pay 必定回傳 payment_url；若沒有代表設定有誤
  if (!data.payment_url) {
    return { ok: false, message: 'LINE Pay 未回傳付款連結，請確認商店設定' }
  }

  return {
    ok: true,
    recTradeId: data.rec_trade_id ?? '',
    bankTransactionId: data.bank_transaction_id ?? '',
    paymentUrl: data.payment_url as string,
  }
}
