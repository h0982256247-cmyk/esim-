import { describe, it, expect, vi, beforeEach } from 'vitest'

// 多租戶隔離回歸（規範 B/I 段「無 RLS，全靠 app 層帶 tenantAdminId」）：
// CommissionSettlement 無 tenantAdminId 直接欄位，租戶歸屬走 group relation。
// 白牌 admin 查各社群結算應付總覽時 where 必須帶 group.tenantAdminId、只看自己租戶；
// SUPER_ADMIN（null）才看全平台。settlements 為空即提早返回（不查 withdrawal），
// 故以 [] mock settlement，聚焦驗證 where 過濾與提早返回。
vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    commissionSettlement: { findMany: vi.fn() },
    withdrawal: { findMany: vi.fn() },
  },
}))

import { getAllSettlementsForAdmin } from '@/lib/services/commission'
import { prisma } from '@/lib/db/prisma'

const whereOf = () =>
  (vi.mocked(prisma.commissionSettlement.findMany).mock.calls[0]?.[0] as { where?: Record<string, unknown> } | undefined)?.where

describe('getAllSettlementsForAdmin — 多租戶隔離', () => {
  beforeEach(() => vi.clearAllMocks())

  it('白牌 admin（tenantAdminId 有值）→ where 限自己租戶（group.tenantAdminId）', async () => {
    vi.mocked(prisma.commissionSettlement.findMany).mockResolvedValue([] as never)
    await getAllSettlementsForAdmin('tenant-A')
    expect(whereOf()).toMatchObject({ group: { tenantAdminId: 'tenant-A' } })
  })

  it('SUPER_ADMIN（null）→ where 為 undefined（看全平台）', async () => {
    vi.mocked(prisma.commissionSettlement.findMany).mockResolvedValue([] as never)
    await getAllSettlementsForAdmin(null)
    expect(whereOf()).toBeUndefined()
  })

  it('無結算 → 提早返回、不查 withdrawal', async () => {
    vi.mocked(prisma.commissionSettlement.findMany).mockResolvedValue([] as never)
    const rows = await getAllSettlementsForAdmin('tenant-A')
    expect(rows).toEqual([])
    expect(prisma.withdrawal.findMany).not.toHaveBeenCalled()
  })
})
