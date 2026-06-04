import { prisma } from '@/lib/db/prisma'

// ─── eSIM 供應商設定 ──────────────────────────────────────────────

export async function getEsimConfig(adminId: string) {
  return prisma.tenantEsimConfig.findUnique({ where: { adminId } })
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
  return prisma.tenantEsimConfig.upsert({
    where: { adminId },
    create: {
      adminId,
      provider: input.provider ?? 'worldmove',
      apiUrl: input.apiUrl,
      merchantId: input.merchantId,
      deptId: input.deptId,
      token: input.token,
    },
    update: {
      provider: input.provider,
      apiUrl: input.apiUrl,
      merchantId: input.merchantId,
      deptId: input.deptId,
      token: input.token,
      isActive: true,
    },
  })
}

// ─── 金流設定 ─────────────────────────────────────────────────────

export async function getPaymentConfigs(adminId: string) {
  return prisma.tenantPaymentConfig.findMany({ where: { adminId } })
}

export async function getPaymentConfig(adminId: string, gateway: string) {
  return prisma.tenantPaymentConfig.findFirst({ where: { adminId, gateway } })
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
  return prisma.tenantPaymentConfig.upsert({
    where: { adminId_gateway: { adminId, gateway: input.gateway } },
    create: {
      adminId,
      gateway: input.gateway,
      partnerKey: input.partnerKey,
      merchantId: input.merchantId,
      env: input.env,
      appId: input.appId,
      appKey: input.appKey,
    },
    update: {
      partnerKey: input.partnerKey,
      merchantId: input.merchantId,
      env: input.env,
      appId: input.appId,
      appKey: input.appKey,
      isActive: true,
    },
  })
}

// ─── 工具 ─────────────────────────────────────────────────────────

export function maskSecret(s: string): string {
  if (s.length <= 4) return '****'
  return '****' + s.slice(-4)
}
