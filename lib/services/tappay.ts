// TapPay Pay by Prime API

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
}

export type TapPayChargeResult =
  | { ok: true; recTradeId: string; bankTransactionId: string }
  | { ok: false; message: string }

function getConfig() {
  const partnerKey = process.env.TAPPAY_PARTNER_KEY
  const merchantId = process.env.TAPPAY_MERCHANT_ID
  const env = process.env.TAPPAY_ENV === 'production' ? 'production' : 'sandbox'

  if (!partnerKey || !merchantId) throw new Error('TapPay credentials not set')

  const baseUrl = env === 'production'
    ? 'https://prod.tappaysdk.com/tpc'
    : 'https://sandbox.tappaysdk.com/tpc'

  return { partnerKey, merchantId, baseUrl }
}

export async function tapPayCharge(input: TapPayChargeInput): Promise<TapPayChargeResult> {
  const { partnerKey, merchantId, baseUrl } = getConfig()

  const body = {
    prime: input.prime,
    partner_key: partnerKey,
    merchant_id: merchantId,
    details: input.details,
    amount: input.amount,
    order_number: input.orderId,
    cardholder: input.cardholder,
    remember: false,
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
    recTradeId: data.rec_trade_id,
    bankTransactionId: data.bank_transaction_id,
  }
}

// ─── Webhook 驗章 ─────────────────────────────────────────────────
// TapPay 未提供 HMAC signature；防偽靠 partner_key header 比對

export function verifyTapPayWebhook(req: Request): boolean {
  const key = req.headers.get('x-api-key')
  return key === process.env.TAPPAY_PARTNER_KEY
}

// ─── LINE Pay ──────────────────────────────────────────────────────
// TapPay LINE Pay 也是 Pay by Prime 流程，前端取得 prime 後同一支 API 收款
// 差異：prime 由 LINE Pay SDK 產生，merchant_id 可能不同
// 此處共用 tapPayCharge，merchant_id 由環境變數 TAPPAY_LINEPAY_MERCHANT_ID 覆蓋
