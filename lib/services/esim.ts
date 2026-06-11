import crypto from 'crypto'
import { prisma } from '@/lib/db/prisma'
import { markOrderCompleted, markOrderEsimPending } from './order'
import { notifyEsimReady, notifyEsimPending } from './notification'
import { safeDecrypt } from '@/lib/utils/crypto'

// ─── 世界移動 API 簽章 ────────────────────────────────────────────

function buildWmSignature(merchantId: string, deptId: string, token: string, body: string): string {
  // SHA-1(merchantId + deptId + token + body)
  const raw = merchantId + deptId + token + body
  return crypto.createHash('sha1').update(raw).digest('hex')
}

async function getWmConfig(tenantAdminId?: string | null) {
  if (tenantAdminId) {
    const cfg = await prisma.tenantEsimConfig.findUnique({
      where: { adminId: tenantAdminId },
      select: { apiUrl: true, merchantId: true, deptId: true, token: true, isActive: true },
    })
    if (cfg && cfg.isActive) {
      return { apiUrl: cfg.apiUrl, merchantId: cfg.merchantId, deptId: cfg.deptId, token: cfg.token }
    }
  }

  const apiUrl = process.env.NODE_ENV === 'production'
    ? process.env.ESIM_SUPPLIER_API_URL!
    : (process.env.ESIM_SUPPLIER_API_URL_TEST ?? process.env.ESIM_SUPPLIER_API_URL!)
  const merchantId = process.env.ESIM_MERCHANT_ID!
  const deptId = process.env.ESIM_DEPT_ID!
  const token = process.env.ESIM_TOKEN!

  if (!merchantId || !deptId || !token) throw new Error('World Move API credentials not set')
  return { apiUrl, merchantId, deptId, token }
}

async function wmPost(endpoint: string, payload: object, tenantAdminId?: string | null): Promise<unknown> {
  const { apiUrl, merchantId, deptId, token } = await getWmConfig(tenantAdminId)
  const body = JSON.stringify(payload)
  const sign = buildWmSignature(merchantId, deptId, token, body)

  const res = await fetch(`${apiUrl}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'merchantId': merchantId,
      'deptId': deptId,
      'sign': sign,
    },
    body,
  })

  if (!res.ok) throw new Error(`World Move API HTTP ${res.status}`)
  return res.json()
}

// ─── 查詢訂單 eSIM 啟動碼 ────────────────────────────────────────

interface WmEsimResult {
  wmOrderId: string
  wmOrderSn?: string
  wmOrderTime?: string
  esimRcode?: string
  esimQrcode?: string
  esimLpa?: string
  esimPin1?: string
  esimPin2?: string
  esimPuk1?: string
  esimPuk2?: string
  esimCfCode?: string
  esimApnExplain?: string
  esimIccid?: string
  activationStart?: Date
  activationEnd?: Date
}

async function fetchEsimCodes(wmOrderId: string, tenantAdminId?: string | null): Promise<WmEsimResult | null> {
  try {
    const data = await wmPost('/api/order/esim/query', { orderId: wmOrderId }, tenantAdminId) as Record<string, unknown>

    if (!data || data.code !== '0000') return null

    const item = (data.data as Record<string, unknown>[] | undefined)?.[0]
    if (!item) return null

    return {
      wmOrderId,
      wmOrderSn: item.orderSn as string | undefined,
      wmOrderTime: item.orderTime as string | undefined,
      esimRcode: item.rCode as string | undefined,
      esimQrcode: item.qrCode as string | undefined,
      esimLpa: item.lpa as string | undefined,
      esimPin1: item.pin1 as string | undefined,
      esimPin2: item.pin2 as string | undefined,
      esimPuk1: item.puk1 as string | undefined,
      esimPuk2: item.puk2 as string | undefined,
      esimCfCode: item.cfCode as string | undefined,
      esimApnExplain: item.apnExplain as string | undefined,
      esimIccid: item.iccid as string | undefined,
      activationStart: item.activationStart ? new Date(item.activationStart as string) : undefined,
      activationEnd: item.activationEnd ? new Date(item.activationEnd as string) : undefined,
    }
  } catch {
    return null
  }
}

// ─── 下單到世界移動（PUSH 流程：2.1 eSIM下單）────────────────────
//
// 流程：付款 → 我們呼叫 /Api/SOrder/mybuyesim (systemMail=false) → 拿到 wmOrderId
//   → WM 1-3 分鐘內推 2.2 callback → 我們收到 rcode（但還沒 QR）
//   → 用戶按「我要安裝」→ 我們呼叫 3.1 → WM 推 3.2 callback 給 QR + LPA
//
// 為什麼 systemMail=false：我們透過 LIFF 自己給用戶看 QR，不需要 WM 寄信。
// 但 email 欄位仍是必填（WM 要求），用戶 email 解密後傳入；無 email 則用 lineUid 組 placeholder。

async function placeWmOrder(orderId: string, tenantAdminId?: string | null): Promise<string | null> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      orderItems: { include: { product: { include: { supplierProduct: true } } } },
      user:       { select: { lineUid: true, email: true } },
    },
  })
  if (!order || !order.orderItems[0]) return null

  const item = order.orderItems[0]
  const wmproductId = item.product.supplierProduct?.wmProductId
  if (!wmproductId) return null

  // 取用戶 email（可能加密）；沒有就用 lineUid 組 placeholder（systemMail=false 不會真的寄）
  const rawEmail = order.user.email
  const email = rawEmail
    ? safeDecrypt(rawEmail)
    : `${order.user.lineUid}@noreply.local`

  const { apiUrl, merchantId, deptId, token } = await getWmConfig(tenantAdminId)
  const qty = item.qty
  const prodList = [{ wmproductId, qty }]

  // encStr = SHA1(merchantId + deptId + email + prodList(wmproductId+qty) + token)
  const prodListStr = prodList.map(p => p.wmproductId + p.qty).join('')
  const raw = merchantId + deptId + email + prodListStr + token
  const encStr = crypto.createHash('sha1').update(raw).digest('hex')

  try {
    const res = await fetch(`${apiUrl}/Api/SOrder/mybuyesim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchantId, deptId, email, prodList,
        systemMail: false,    // 不要 WM 寄 mail，我們透過 LIFF 顯示
        encStr,
      }),
    })
    if (!res.ok) return null
    const data = await res.json() as Record<string, unknown>
    if (data.code !== 0) return null
    return (data.orderId as string) ?? null
  } catch {
    return null
  }
}

// ─── 觸發兌換（3.1 兌換兌換碼）— 用戶按「我要安裝」時呼叫 ────────────────

export async function triggerEsimRedemption(orderId: string): Promise<{ ok: boolean; reason?: string }> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true, status: true,
      esimRcode: true, esimQrcode: true,
      redeemedAt: true, activatedAt: true,
      user: {
        select: {
          groupMembership: { select: { group: { select: { tenantAdminId: true } } } },
          ownedGroup:      { select: { tenantAdminId: true } },
        },
      },
    },
  })
  if (!order)                  return { ok: false, reason: '訂單不存在' }
  if (!order.esimRcode)        return { ok: false, reason: '兌換碼尚未產生，請稍後再試' }
  if (order.activatedAt)       return { ok: false, reason: '此 eSIM 已激活' }
  if (order.esimQrcode)        return { ok: true }   // QR 已存在 → 幂等
  // redeemedAt 已設但 QR 未到 → 視為已觸發過，等 callback；前端會 polling
  if (order.redeemedAt)        return { ok: true }

  const tenantAdminId = order.user.groupMembership?.group.tenantAdminId
    ?? order.user.ownedGroup?.tenantAdminId
    ?? null

  const { apiUrl, merchantId, token } = await getWmConfig(tenantAdminId)
  const qrcodeType = 2   // 0=URL, 1=文字, 2=兩者
  const rcode = order.esimRcode

  // encStr = SHA1(merchantId + rcode + qrcodeType + token)
  const encStr = crypto.createHash('sha1')
    .update(merchantId + rcode + qrcodeType + token)
    .digest('hex')

  try {
    const res = await fetch(`${apiUrl}/Api/OrderRedemption/redemption`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ merchantId, rcode, qrcodeType, encStr }),
    })
    if (!res.ok) return { ok: false, reason: `WM HTTP ${res.status}` }
    const data = await res.json() as Record<string, unknown>
    if (data.code !== 0) return { ok: false, reason: (data.msg as string) ?? '兌換失敗' }

    // 標記 redeemedAt（鎖死轉贈；3.2 callback 之後會補上 QR/LPA）
    // 同時若有 pending 未領取的 gift 自動取消（避免領了卻領到已 redeem 的卡）
    const now = new Date()
    await prisma.$transaction(async tx => {
      await tx.order.update({
        where: { id: orderId },
        data: { redeemedAt: now },
      })
      await tx.orderGift.updateMany({
        where: { orderId, claimedAt: null, cancelledAt: null },
        data: { cancelledAt: now, cancelReason: 'buyer_redeemed' },
      })
    })
    return { ok: true }
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : '兌換失敗' }
  }
}

// ─── 主流程：付款後觸發下單（PUSH 模式，不再 polling）─────────────

export async function triggerEsimActivation(orderId: string): Promise<void> {
  const orderInfo = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      userId: true,
      orderItems: { select: { productName: true } },
      user: {
        select: {
          groupMembership: { select: { group: { select: { tenantAdminId: true } } } },
          ownedGroup: { select: { tenantAdminId: true } },
        },
      },
    },
  })
  const userId = orderInfo?.userId ?? ''
  const productName = orderInfo?.orderItems[0]?.productName ?? 'eSIM'
  const tenantAdminId = orderInfo?.user?.groupMembership?.group?.tenantAdminId
    ?? orderInfo?.user?.ownedGroup?.tenantAdminId
    ?? null

  // 只負責下單，等 WM 推 2.5 callback 完成餘下流程
  const wmOrderId = await placeWmOrder(orderId, tenantAdminId)
  if (!wmOrderId) {
    await markOrderEsimPending(orderId)
    notifyEsimPending(userId, productName).catch(() => {})
    return
  }

  await prisma.order.update({
    where: { id: orderId },
    data: { wmOrderId },
  })
  // 訂單維持 PAID 狀態；callback 到了會轉成 COMPLETED
  // 若 callback 久未到（>5 分鐘），cron 或 admin 補發機制處理
}

// ─── 查詢 eSIM 用量 ───────────────────────────────────────────────

export interface EsimUsage {
  iccid: string
  totalData: number    // MB
  usedData: number     // MB
  remainingData: number // MB
  unit: string         // 'MB' | 'GB'
}

export async function queryEsimUsage(iccid: string, tenantAdminId?: string | null): Promise<EsimUsage | null> {
  try {
    const data = await wmPost('/api/esim/usage', { iccid }, tenantAdminId) as Record<string, unknown>
    if (!data || data.code !== '0000') return null

    const d = data.data as Record<string, unknown>
    if (!d) return null

    const totalData = Number(d.totalData ?? d.total ?? 0)
    const usedData = Number(d.usedData ?? d.used ?? 0)
    const unit = (d.dataUnit ?? d.unit ?? 'MB') as string

    return {
      iccid,
      totalData,
      usedData,
      remainingData: Math.max(0, totalData - usedData),
      unit,
    }
  } catch {
    return null
  }
}

// ─── 查詢我的報價（myQueryAll）────────────────────────────────────
// 端點：/Api/QuoteMg/myQueryAll
// 簽章：SHA-1(merchantId + token)  ← 不含 deptId 也不含 body
// ▲ 世界移動建議每週查詢一次；切勿在每筆訂購時呼叫，否則將被鎖 IP。

export interface SupplierProductInfo {
  wmproductId:    string
  productId?:     string  // 供應商自身商品編號
  productName?:   string  // 商品名稱（如 "Japan, 3 Days, 1GB"）
  productRegion?: string  // 適用地區
  productPrice:   number  // 經銷商成本價（台幣）
  productType:    number  // 0=eSIM, 1=SIM卡, 2=充值SIM卡
  leSIM:          boolean // true=世界移動, false=當地供應商
}

export type SupplierProductMap = Map<string, SupplierProductInfo>

/**
 * 向世界移動取得所有可購買方案清單，回傳以 wmproductId 為 key 的 Map。
 * 一次呼叫取回全部，供呼叫端批次比對，請勿逐筆觸發。
 */
export async function fetchSupplierProductMap(tenantAdminId?: string | null): Promise<SupplierProductMap> {
  const { apiUrl, merchantId, token } = await getWmConfig(tenantAdminId)
  // 此端點簽章只用 merchantId + token，不帶 deptId 也不帶 body
  const encStr = crypto.createHash('sha1').update(merchantId + token).digest('hex')

  // 8 秒 timeout：上游掛掉時不要拖死整個匯入流程，呼叫端（如 CSV import）會 fallback
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), 8000)
  let res: Response
  try {
    res = await fetch(`${apiUrl}/Api/QuoteMg/myQueryAll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ merchantId, encStr }),
      signal: ac.signal,
    })
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw new Error('World Move QuoteQuery 逾時（8s）')
    throw err
  } finally {
    clearTimeout(timer)
  }
  if (!res.ok) throw new Error(`World Move QuoteQuery HTTP ${res.status}`)

  const data = await res.json() as Record<string, unknown>
  if (data.code !== 0) throw new Error(`World Move QuoteQuery 失敗：${data.msg ?? data.code}`)

  const map: SupplierProductMap = new Map()
  const list = data.prodList as Record<string, unknown>[] | undefined
  for (const item of list ?? []) {
    const id = item.wmproductId as string | undefined
    if (id) {
      map.set(id, {
        wmproductId:    id,
        productId:      (item.productId      as string | undefined) ?? undefined,
        productName:    (item.productName    as string | undefined) ?? undefined,
        productRegion:  (item.productRegion  as string | undefined) ?? undefined,
        productPrice:   Number(item.productPrice ?? 0),
        productType:    Number(item.productType  ?? 0),
        leSIM:          Boolean(item.leSIM),
      })
    }
  }
  return map
}

// ─── Admin：補發（手動觸發）──────────────────────────────────────

export async function retryEsimActivation(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { wmOrderId: true },
  })

  if (order?.wmOrderId) {
    const esimData = await fetchEsimCodes(order.wmOrderId)
    if (esimData) {
      await markOrderCompleted(orderId, esimData)
      return
    }
  }

  // 重新下單
  await triggerEsimActivation(orderId)
}
