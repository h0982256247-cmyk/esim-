import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAuth } from '@/lib/auth/platform'
import { prisma } from '@/lib/db/prisma'
import { fetchSupplierProductMap } from '@/lib/services/esim'
import { ProductStatus, SupplierProductStatus } from '@prisma/client'

// POST /api/admin/products/validate/apply
// 重新跑一次驗證，並一次套用：
//   1. 供應商查無 → Product.status=AUTO_INACTIVE，SupplierProduct.status=AUTO_INACTIVE
//   2. 成本價不符 → Product.costPrice、SupplierProduct.costPrice 同步為供應商目前價
//   3. 觸及的 SupplierProduct 一律寫入 lastSyncAt
// 售價不動：成本變動後讓 admin 自行決定是否調整售價。
export async function POST(req: NextRequest) {
  const auth = await requirePlatformAuth(req)
  if (auth instanceof NextResponse) return auth

  const products = await prisma.product.findMany({
    where: auth.tenantAdminId ? { tenantAdminId: auth.tenantAdminId } : undefined,
    select: {
      id: true,
      costPrice: true,
      supplierSkuId: true,
      supplierProduct: { select: { id: true, wmProductId: true } },
    },
  })

  // 取得供應商最新清單；失敗則整批回滾，不擅自下架
  let supplierMap: Awaited<ReturnType<typeof fetchSupplierProductMap>>
  try {
    supplierMap = await fetchSupplierProductMap(auth.tenantAdminId)
  } catch (err) {
    const msg = err instanceof Error ? err.message : '無法連線至供應商'
    return NextResponse.json({ error: msg }, { status: 502 })
  }

  const toDisable: { productId: string; supplierProductId: string }[] = []
  const toReprice: { productId: string; supplierProductId: string; newCost: number }[] = []

  for (const p of products) {
    const sp = p.supplierProduct
    if (!sp) continue
    const info = supplierMap.get(sp.wmProductId)
    if (!info) {
      toDisable.push({ productId: p.id, supplierProductId: sp.id })
    } else if (info.productPrice !== p.costPrice) {
      toReprice.push({ productId: p.id, supplierProductId: sp.id, newCost: info.productPrice })
    }
  }

  const now = new Date()
  const touchedSupplierIds = new Set<string>([
    ...toDisable.map(x => x.supplierProductId),
    ...toReprice.map(x => x.supplierProductId),
  ])

  await prisma.$transaction(async tx => {
    // 1. 下架失效方案
    if (toDisable.length > 0) {
      await tx.product.updateMany({
        where: { id: { in: toDisable.map(x => x.productId) } },
        data:  { status: ProductStatus.AUTO_INACTIVE },
      })
      await tx.supplierProduct.updateMany({
        where: { id: { in: toDisable.map(x => x.supplierProductId) } },
        data:  { status: SupplierProductStatus.AUTO_INACTIVE, lastSyncAt: now },
      })
    }

    // 2. 同步成本價
    for (const item of toReprice) {
      await tx.product.update({
        where: { id: item.productId },
        data:  { costPrice: item.newCost },
      })
      await tx.supplierProduct.update({
        where: { id: item.supplierProductId },
        data:  { costPrice: item.newCost, lastSyncAt: now },
      })
    }

    // 3. 其餘已比對通過的方案也戳上 lastSyncAt，避免重複查詢
    const untouchedSupplierIds = products
      .map(p => p.supplierProduct?.id)
      .filter((id): id is string => !!id && !touchedSupplierIds.has(id))

    if (untouchedSupplierIds.length > 0) {
      await tx.supplierProduct.updateMany({
        where: { id: { in: untouchedSupplierIds } },
        data:  { lastSyncAt: now },
      })
    }
  })

  return NextResponse.json({
    disabled: toDisable.length,
    repriced: toReprice.length,
    syncedAt: now.toISOString(),
  })
}
