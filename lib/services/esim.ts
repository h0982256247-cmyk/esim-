import crypto from 'crypto'
import { prisma } from '@/lib/db/prisma'
import { markOrderCompleted, markOrderEsimPending, incrementRetryCount } from './order'
import { notifyEsimReady, notifyEsimPending } from './notification'

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

// ─── 下單到世界移動 ───────────────────────────────────────────────

async function placeWmOrder(orderId: string, tenantAdminId?: string | null): Promise<string | null> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { orderItems: { include: { product: true } } },
  })
  if (!order || !order.orderItems[0]) return null

  const item = order.orderItems[0]
  try {
    const data = await wmPost('/api/order/create', {
      outOrderId: orderId,
      skuId: item.product.supplierSkuId,
      qty: item.qty,
    }, tenantAdminId) as Record<string, unknown>

    if (data.code !== '0000') return null
    return (data.data as Record<string, unknown>)?.orderId as string ?? null
  } catch {
    return null
  }
}

// ─── 主流程：觸發 eSIM 啟動，含 retry ────────────────────────────

const MAX_RETRIES = 3
const RETRY_DELAY_MS = 5000

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function triggerEsimActivation(orderId: string): Promise<void> {
  // 取得 userId 和商品名稱供通知用，以及 tenantAdminId 供 API 選擇用
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

  // 1. 下單到世界移動
  const wmOrderId = await placeWmOrder(orderId, tenantAdminId)
  if (!wmOrderId) {
    await markOrderEsimPending(orderId)
    notifyEsimPending(userId, productName).catch(() => {})
    return
  }

  // 儲存 wmOrderId
  await prisma.order.update({
    where: { id: orderId },
    data: { wmOrderId },
  })

  // 2. 輪詢取啟動碼（最多 3 次，每次間隔 5 秒）
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await sleep(RETRY_DELAY_MS)
      await incrementRetryCount(orderId)
    }

    const esimData = await fetchEsimCodes(wmOrderId, tenantAdminId)
    if (esimData) {
      await markOrderCompleted(orderId, esimData)
      notifyEsimReady(userId, productName).catch(() => {})
      return
    }
  }

  // 3 次失敗 → esim_pending
  await markOrderEsimPending(orderId)
  notifyEsimPending(userId, productName).catch(() => {})
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
