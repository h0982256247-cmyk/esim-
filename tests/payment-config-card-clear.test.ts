import { describe, it, expect, vi, beforeEach } from 'vitest'

// 換信用卡商戶（merchant ID 變更）時，一次清除該租戶所有記憶卡：
// 舊 merchant 綁的 card token 在新 merchant 無法代扣，不清會導致記憶卡付款失敗。
// 僅信用卡 gateway 觸發；LINE Pay 無記憶卡；merchant 沒變或首次建立都不清。
const { tx } = vi.hoisted(() => ({
  tx: {
    savedCard: { deleteMany: vi.fn() },
    tenantPaymentConfig: { update: vi.fn() },
  },
}))
vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    tenantPaymentConfig: { findUnique: vi.fn(), create: vi.fn() },
    $transaction: vi.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)),
  },
}))
vi.mock('@/lib/utils/crypto', () => ({
  encrypt: vi.fn((x: string) => `enc(${x})`),
  safeDecrypt: vi.fn((x: string) => x),
}))

import { upsertPaymentConfig } from '@/lib/services/tenant-config'
import { prisma } from '@/lib/db/prisma'

const input = (merchantId: string, gateway = 'tappay_credit') => ({
  gateway, partnerKey: 'pk', merchantId, env: 'production',
})

describe('upsertPaymentConfig — 換信用卡 merchant 時清除舊綁卡', () => {
  beforeEach(() => vi.clearAllMocks())

  it('merchant ID 變更（tappay_credit）→ 清除該租戶所有記憶卡', async () => {
    vi.mocked(prisma.tenantPaymentConfig.findUnique).mockResolvedValue({ merchantId: 'OLD_MID' } as never)
    await upsertPaymentConfig('admin1', input('NEW_MID'))
    expect(tx.savedCard.deleteMany).toHaveBeenCalledWith({ where: { user: { tenantAdminId: 'admin1' } } })
  })

  it('merchant ID 未變 → 不清卡', async () => {
    vi.mocked(prisma.tenantPaymentConfig.findUnique).mockResolvedValue({ merchantId: 'SAME_MID' } as never)
    await upsertPaymentConfig('admin1', input('SAME_MID'))
    expect(tx.savedCard.deleteMany).not.toHaveBeenCalled()
  })

  it('LINE Pay gateway 換 merchant → 不清信用卡記憶卡', async () => {
    vi.mocked(prisma.tenantPaymentConfig.findUnique).mockResolvedValue({ merchantId: 'OLD_LP' } as never)
    await upsertPaymentConfig('admin1', input('NEW_LP', 'tappay_linepay'))
    expect(tx.savedCard.deleteMany).not.toHaveBeenCalled()
  })

  it('首次建立（無舊設定）→ 不清卡', async () => {
    vi.mocked(prisma.tenantPaymentConfig.findUnique).mockResolvedValue(null as never)
    await upsertPaymentConfig('admin1', input('MID'))
    expect(tx.savedCard.deleteMany).not.toHaveBeenCalled()
    expect(prisma.tenantPaymentConfig.create).toHaveBeenCalled()
  })
})
