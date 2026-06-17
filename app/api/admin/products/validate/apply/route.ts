import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAuth } from '@/lib/auth/platform'
import { prisma } from '@/lib/db/prisma'
import { fetchSupplierProductMap } from '@/lib/services/esim'
import { Prisma, ProductStatus, SupplierProductStatus } from '@prisma/client'

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

  // 規模背景：商品逾 1 萬筆，成本價異動動輒數千筆。若把「逐筆 update」包進單一
  // interactive transaction，在 PgBouncer connection_limit=1 序列化下會做上萬次往返、
  // 遠超 Prisma 預設 5s 交易逾時 → 交易過期、route 拋錯回 500 空 body（前端 JSON 解析失敗、
  // 「套用中…」卡死）。改用與匯入相同的批次 `UPDATE ... FROM (VALUES ...)`（每批 1000 列），
  // 不包大交易；本流程冪等（重跑會重新比對），中途失敗可安全重試。
  const CHUNK = 1000

  // 1. 下架失效方案（updateMany 本身就是單句 SQL；分批避免 IN 清單過長）
  for (let i = 0; i < toDisable.length; i += CHUNK) {
    const chunk = toDisable.slice(i, i + CHUNK)
    await prisma.product.updateMany({
      where: { id: { in: chunk.map(x => x.productId) } },
      data:  { status: ProductStatus.AUTO_INACTIVE },
    })
    await prisma.supplierProduct.updateMany({
      where: { id: { in: chunk.map(x => x.supplierProductId) } },
      data:  { status: SupplierProductStatus.AUTO_INACTIVE, lastSyncAt: now },
    })
  }

  // 2. 同步成本價（Product + SupplierProduct 兩表，批次 bulk SQL）
  for (let i = 0; i < toReprice.length; i += CHUNK) {
    const chunk = toReprice.slice(i, i + CHUNK)
    const pv = chunk.map(x => Prisma.sql`(${x.productId}::text, ${x.newCost}::int)`)
    await prisma.$executeRaw`
      UPDATE products AS p SET cost_price = v.cost, updated_at = NOW()
      FROM (VALUES ${Prisma.join(pv)}) AS v(id, cost)
      WHERE p.id = v.id
    `
    const sv = chunk.map(x => Prisma.sql`(${x.supplierProductId}::text, ${x.newCost}::int)`)
    await prisma.$executeRaw`
      UPDATE supplier_products AS s SET cost_price = v.cost, last_sync_at = NOW(), updated_at = NOW()
      FROM (VALUES ${Prisma.join(sv)}) AS v(id, cost)
      WHERE s.id = v.id
    `
  }

  // 3. 其餘已比對通過的方案也戳上 lastSyncAt，避免重複查詢
  const untouchedSupplierIds = products
    .map(p => p.supplierProduct?.id)
    .filter((id): id is string => !!id && !touchedSupplierIds.has(id))

  for (let i = 0; i < untouchedSupplierIds.length; i += CHUNK) {
    await prisma.supplierProduct.updateMany({
      where: { id: { in: untouchedSupplierIds.slice(i, i + CHUNK) } },
      data:  { lastSyncAt: now },
    })
  }

  return NextResponse.json({
    disabled: toDisable.length,
    repriced: toReprice.length,
    syncedAt: now.toISOString(),
  })
}
