import { describe, it, expect, vi, beforeEach } from 'vitest'

// 解散社群安全鎖：只有「全新、無任何活動」的社群可解散（成員/分潤/結算/提領/用券任一 > 0 就擋）。
// 通過檢查才刪券 + 清社群主殘留離群列 + 刪社群；否則不得動任何寫入。
const { tx } = vi.hoisted(() => ({
  tx: {
    group: { findUnique: vi.fn(), delete: vi.fn() },
    groupMember: { count: vi.fn(), deleteMany: vi.fn() },
    commission: { count: vi.fn() },
    commissionSettlement: { count: vi.fn() },
    withdrawal: { count: vi.fn() },
    coupon: { count: vi.fn(), deleteMany: vi.fn() },
  },
}))
vi.mock('@/lib/db/prisma', () => ({
  prisma: { $transaction: vi.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)) },
}))
vi.mock('@/lib/services/coupon', () => ({ issueCoupon: vi.fn(), getCouponLevel: vi.fn(() => 'A') }))
vi.mock('@/lib/services/notification', () => ({
  notifyGroupApproved: vi.fn(() => Promise.resolve()),
  notifyGroupRejected: vi.fn(() => Promise.resolve()),
}))

import { dissolveGroup } from '@/lib/services/group'

const FRESH = { id: 'g1', ownerId: 'u1', tenantAdminId: 't1' }
const allCounts = (n: number) => {
  tx.groupMember.count.mockResolvedValue(n as never)
  tx.commission.count.mockResolvedValue(n as never)
  tx.commissionSettlement.count.mockResolvedValue(n as never)
  tx.withdrawal.count.mockResolvedValue(n as never)
  tx.coupon.count.mockResolvedValue(n as never)
}

describe('dissolveGroup — 解散安全鎖', () => {
  beforeEach(() => vi.clearAllMocks())

  it('全新社群（無活動）→ 作廢券 + 清離群列 + 刪社群，回 ok', async () => {
    tx.group.findUnique.mockResolvedValue(FRESH as never)
    allCounts(0)
    const r = await dissolveGroup('g1', 't1')
    expect(r).toEqual({ ok: true })
    expect(tx.coupon.deleteMany).toHaveBeenCalledWith({ where: { sourceGroupId: 'g1' } })
    expect(tx.groupMember.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: 'u1' }) }),
    )
    expect(tx.group.delete).toHaveBeenCalledWith({ where: { id: 'g1' } })
  })

  it('有分潤記錄 → 擋下，且完全不刪除', async () => {
    tx.group.findUnique.mockResolvedValue(FRESH as never)
    tx.groupMember.count.mockResolvedValue(0 as never)
    tx.commission.count.mockResolvedValue(3 as never)   // 有分潤
    tx.commissionSettlement.count.mockResolvedValue(0 as never)
    tx.withdrawal.count.mockResolvedValue(0 as never)
    tx.coupon.count.mockResolvedValue(0 as never)
    const r = await dissolveGroup('g1', 't1')
    expect(r.ok).toBe(false)
    expect(tx.group.delete).not.toHaveBeenCalled()
    expect(tx.coupon.deleteMany).not.toHaveBeenCalled()
    expect(tx.groupMember.deleteMany).not.toHaveBeenCalled()
  })

  it('有成員 → 擋下', async () => {
    tx.group.findUnique.mockResolvedValue(FRESH as never)
    tx.groupMember.count.mockResolvedValue(1 as never)  // 有成員
    tx.commission.count.mockResolvedValue(0 as never)
    tx.commissionSettlement.count.mockResolvedValue(0 as never)
    tx.withdrawal.count.mockResolvedValue(0 as never)
    tx.coupon.count.mockResolvedValue(0 as never)
    const r = await dissolveGroup('g1', 't1')
    expect(r.ok).toBe(false)
    expect(tx.group.delete).not.toHaveBeenCalled()
  })

  it('跨租戶 → 無權，不刪', async () => {
    tx.group.findUnique.mockResolvedValue({ ...FRESH, tenantAdminId: 'OTHER' } as never)
    const r = await dissolveGroup('g1', 't1')
    expect(r).toEqual({ ok: false, reason: expect.stringContaining('無權') })
    expect(tx.group.delete).not.toHaveBeenCalled()
  })

  it('SUPER_ADMIN（tenantAdminId=null）→ 不受租戶限制，可解散', async () => {
    tx.group.findUnique.mockResolvedValue({ ...FRESH, tenantAdminId: 'anyone' } as never)
    allCounts(0)
    const r = await dissolveGroup('g1', null)
    expect(r).toEqual({ ok: true })
    expect(tx.group.delete).toHaveBeenCalled()
  })
})
