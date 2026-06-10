import { prisma } from '@/lib/db/prisma'
import { encrypt, safeDecrypt } from '@/lib/utils/crypto'

// ─── eSIM 供應商設定 ──────────────────────────────────────────────

/** Returns config with decrypted token (for internal server use only) */
export async function getEsimConfig(adminId: string) {
  const cfg = await prisma.tenantEsimConfig.findUnique({ where: { adminId } })
  if (!cfg) return null
  return { ...cfg, token: safeDecrypt(cfg.token) }
}

export async function upsertEsimConfig(
  adminId: string,
  input: {
    provider?: string
    apiUrl: string
    merchantId: string
    deptId: string
    token: string
  },
) {
  const encryptedToken = encrypt(input.token)
  // 拆 upsert：適配 @prisma/adapter-pg 回傳異常
  const existing = await prisma.tenantEsimConfig.findUnique({ where: { adminId } })
  if (existing) {
    return prisma.tenantEsimConfig.update({
      where: { adminId },
      data: {
        provider: input.provider,
        apiUrl: input.apiUrl,
        merchantId: input.merchantId,
        deptId: input.deptId,
        token: encryptedToken,
        isActive: true,
      },
    })
  }
  return prisma.tenantEsimConfig.create({
    data: {
      adminId,
      provider: input.provider ?? 'worldmove',
      apiUrl: input.apiUrl,
      merchantId: input.merchantId,
      deptId: input.deptId,
      token: encryptedToken,
    },
  })
}

// ─── 金流設定 ─────────────────────────────────────────────────────

/** Returns configs with decrypted keys (for internal server use only) */
export async function getPaymentConfigs(adminId: string) {
  const cfgs = await prisma.tenantPaymentConfig.findMany({ where: { adminId } })
  return cfgs.map(c => ({
    ...c,
    partnerKey: safeDecrypt(c.partnerKey),
    appKey: c.appKey ? safeDecrypt(c.appKey) : c.appKey,
  }))
}

/** Returns single config with decrypted keys (for internal server use only) */
export async function getPaymentConfig(adminId: string, gateway: string) {
  const c = await prisma.tenantPaymentConfig.findFirst({ where: { adminId, gateway } })
  if (!c) return null
  return {
    ...c,
    partnerKey: safeDecrypt(c.partnerKey),
    appKey: c.appKey ? safeDecrypt(c.appKey) : c.appKey,
  }
}

export async function upsertPaymentConfig(
  adminId: string,
  input: {
    gateway: string
    partnerKey: string
    merchantId: string
    env: string
    appId?: string
    appKey?: string
  },
) {
  const encryptedPartnerKey = encrypt(input.partnerKey)
  const encryptedAppKey = input.appKey ? encrypt(input.appKey) : undefined

  // 拆 upsert：適配 @prisma/adapter-pg
  const existing = await prisma.tenantPaymentConfig.findUnique({
    where: { adminId_gateway: { adminId, gateway: input.gateway } },
  })
  if (existing) {
    return prisma.tenantPaymentConfig.update({
      where: { adminId_gateway: { adminId, gateway: input.gateway } },
      data: {
        partnerKey: encryptedPartnerKey,
        merchantId: input.merchantId,
        env: input.env,
        appId: input.appId,
        appKey: encryptedAppKey,
        isActive: true,
      },
    })
  }
  return prisma.tenantPaymentConfig.create({
    data: {
      adminId,
      gateway: input.gateway,
      partnerKey: encryptedPartnerKey,
      merchantId: input.merchantId,
      env: input.env,
      appId: input.appId,
      appKey: encryptedAppKey,
    },
  })
}

// ─── 工具 ─────────────────────────────────────────────────────────

export function maskSecret(s: string): string {
  if (s.length <= 4) return '****'
  return '****' + s.slice(-4)
}
