import { prisma } from '@/lib/db/prisma'
import { ProductStatus, SupplierProductStatus, SupplierProductType } from '@prisma/client'
import type { SupplierProductMap } from './esim'

export async function getActiveProducts(countryCode?: string, tenantAdminId?: string | null) {
  return prisma.product.findMany({
    where: {
      status: ProductStatus.ACTIVE,
      // 雙重保險：供應商側下架的方案也不應出現在前台
      supplierProduct: { status: SupplierProductStatus.ACTIVE },
      ...(countryCode ? { countryCode } : {}),
      ...(tenantAdminId != null ? { tenantAdminId } : {}),
    },
    orderBy: [{ countryCode: 'asc' }, { displayDays: 'asc' }],
    select: {
      id: true,
      countryCode: true,
      countryNameZh: true,
      countryNameEn: true,
      countryFlag: true,
      displayDays: true,
      dataCapacity: true,
      description: true,
      sellPrice: true,
      sortOrder: true,
    },
  })
}

export async function getProductById(id: string) {
  return prisma.product.findUnique({
    where: { id },
    select: {
      id: true,
      countryCode: true,
      countryNameZh: true,
      countryNameEn: true,
      countryFlag: true,
      displayDays: true,
      dataCapacity: true,
      description: true,
      sellPrice: true,
      costPrice: true,    // 下單時寫入 OrderItem.unitCost 作為成本快照
      status: true,
      supplierSkuId: true,
    },
  })
}

export async function getAvailableCountries(tenantAdminId?: string | null) {
  const products = await prisma.product.findMany({
    where: {
      status: ProductStatus.ACTIVE,
      supplierProduct: { status: SupplierProductStatus.ACTIVE },
      ...(tenantAdminId != null ? { tenantAdminId } : {}),
    },
    select: {
      countryCode: true,
      countryNameZh: true,
      countryNameEn: true,
      countryFlag: true,
    },
    distinct: ['countryCode'],
    orderBy: { sortOrder: 'asc' },
  })
  return products
}

// ─── Admin operations ────────────────────────────────────────────

export interface GetAllProductsAdminOptions {
  tenantAdminId?: string | null
  page?: number      // 1-based
  pageSize?: number  // default 100
  q?: string         // 跨欄位搜尋（國家名/代碼/供應商 SKU/流量）
}

export async function getAllProductsAdmin(opts: GetAllProductsAdminOptions = {}) {
  const page = Math.max(1, opts.page ?? 1)
  const pageSize = Math.min(500, Math.max(1, opts.pageSize ?? 100))
  const q = opts.q?.trim()

  // Prisma where 條件組合
  const where: import('@prisma/client').Prisma.ProductWhereInput = {
    ...(opts.tenantAdminId ? { tenantAdminId: opts.tenantAdminId } : {}),
    ...(q
      ? {
          OR: [
            { countryNameZh: { contains: q, mode: 'insensitive' } },
            { countryNameEn: { contains: q, mode: 'insensitive' } },
            { countryCode:   { contains: q, mode: 'insensitive' } },
            { dataCapacity:  { contains: q, mode: 'insensitive' } },
            { planCode:      { contains: q, mode: 'insensitive' } },
            { supplierProduct: { wmProductId: { contains: q, mode: 'insensitive' } } },
          ],
        }
      : {}),
  }

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: [{ countryCode: 'asc' }, { displayDays: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        supplierProduct: {
          select: { wmProductId: true, productName: true, status: true, lastSyncAt: true },
        },
      },
    }),
    prisma.product.count({ where }),
  ])

  return { products, total, page, pageSize }
}

export type ProductUpsertInput = {
  supplierSkuId: string
  planCode?: string | null
  countryCode: string
  countryNameZh: string
  countryNameEn: string
  countryFlag?: string | null
  displayDays: number
  dataCapacity?: string | null
  description?: string | null
  networkType?: string | null
  isNativeSim?: boolean
  sellPrice: number
  costPrice: number
  sortOrder?: number
  tenantAdminId?: string | null
}

export async function upsertProduct(id: string | undefined, input: ProductUpsertInput) {
  if (id) {
    return prisma.product.update({ where: { id }, data: input })
  }
  return prisma.product.create({ data: input })
}

export async function setProductStatus(id: string, status: ProductStatus) {
  return prisma.product.update({ where: { id }, data: { status } })
}

// ─── CSV batch import ─────────────────────────────────────────────

export type CsvProductRow = {
  supplierSkuId: string
  planCode?: string
  countryCode: string
  countryNameZh: string
  countryNameEn: string
  countryFlag?: string
  displayDays: number
  dataCapacity?: string
  description?: string
  networkType?: string
  isNativeSim?: boolean
  sellPrice: number
  costPrice: number
  sortOrder?: number
}

// WM productType (0/1/2) → Prisma enum 對應
const WM_PRODUCT_TYPE_MAP: Record<number, SupplierProductType> = {
  0: SupplierProductType.ESIM,
  1: SupplierProductType.SIM,
  2: SupplierProductType.SIM_TOPUP,
}

// 批次匯入：idempotent，重新匯入同樣的 CSV 不會造成 duplicate。
//
// DATABASE_URL 走 PgBouncer connection_limit=1，loop 內每個 await 都要排隊，
// 50 列以上 transaction 必爆。改用 batch query 寫入：
//
//   1. findMany 取出 CSV 中已存在的 SupplierProduct
//   2. createMany 寫入新的 SupplierProduct（skipDuplicates 防競態）
//   3. updateMany-style 逐筆 update 既有的 SupplierProduct.product_name + costPrice
//      （PgBouncer 限制：仍是逐筆，但只對「需要 update」的列；通常很少）
//   4. 再 findMany 拿到所有 SupplierProduct.id 對照表
//   5. findMany 取出 (tenantAdminId, supplierSkuId) 已存在的 Product
//   6. 對既有 Product → update（保留 id，OrderItem.productId 仍指向同一列）
//      對新 Product   → createMany
//
// 不用 $transaction：失敗會留 orphan，但這些是合法資料、可被之後的匯入引用，
// 不傷害一致性。寧可放棄 strict atomicity 換取速度。
//
// 為什麼 update 既有 Product 而非 delete+create：OrderItem.productId 是 FK，
// 砍掉重練會破壞訂單關聯。保留 id 是唯一安全做法。
export async function batchCreateProducts(
  rows: CsvProductRow[],
  tenantAdminId?: string | null,
  supplierMap?: SupplierProductMap,
): Promise<{ count: number; created: number; updated: number }> {
  if (rows.length === 0) return { count: 0, created: 0, updated: 0 }

  // 唯一化 wmProductId（CSV 同 SKU 多列）
  const wmIds = Array.from(new Set(rows.map(r => r.supplierSkuId)))

  // ─── Step 1: 抓已存在的 SupplierProduct ──────────────────────────
  const existing = await prisma.supplierProduct.findMany({
    where: { wmProductId: { in: wmIds } },
    select: { id: true, wmProductId: true, productName: true, costPrice: true },
  })
  const existingByWmId = new Map(existing.map(s => [s.wmProductId, s]))

  // ─── Step 2: 寫入新的 SupplierProduct ─────────────────────────────
  const newSupplierData = wmIds
    .filter(id => !existingByWmId.has(id))
    .map(id => {
      const row = rows.find(r => r.supplierSkuId === id)!
      const wmInfo = supplierMap?.get(id)
      const productName = wmInfo?.productName ?? (row.countryNameZh || row.supplierSkuId)
      const productType = wmInfo
        ? (WM_PRODUCT_TYPE_MAP[wmInfo.productType] ?? SupplierProductType.ESIM)
        : SupplierProductType.ESIM
      const costPrice = wmInfo?.productPrice ?? row.costPrice
      return { wmProductId: id, productName, productType, costPrice }
    })
  if (newSupplierData.length > 0) {
    await prisma.supplierProduct.createMany({ data: newSupplierData, skipDuplicates: true })
  }

  // ─── Step 3: 對既有 SupplierProduct 更新 product_name + costPrice ─
  // 重新匯入時，wmInfo 提供新名稱 → 覆寫舊資料（解決「東南亞」之類錯誤）
  for (const wmId of wmIds) {
    const existingRow = existingByWmId.get(wmId)
    if (!existingRow) continue
    const row = rows.find(r => r.supplierSkuId === wmId)!
    const wmInfo = supplierMap?.get(wmId)
    const desiredName = wmInfo?.productName ?? (row.countryNameZh || row.supplierSkuId)
    const desiredCost = wmInfo?.productPrice ?? row.costPrice
    if (existingRow.productName === desiredName && existingRow.costPrice === desiredCost) continue
    await prisma.supplierProduct.update({
      where: { id: existingRow.id },
      data: { productName: desiredName, costPrice: desiredCost },
    })
  }

  // ─── Step 4: 拿到全部 SupplierProduct.id 對照表 ──────────────────
  const allSuppliers = await prisma.supplierProduct.findMany({
    where: { wmProductId: { in: wmIds } },
    select: { id: true, wmProductId: true },
  })
  const supplierIdMap = new Map(allSuppliers.map(s => [s.wmProductId, s.id]))

  // ─── Step 5: 抓 (tenantAdminId, supplierSkuId) 已存在的 Product ───
  // 同 tenant + 同 SKU = 視為「同一個方案」，重新匯入更新而非新建
  const supplierIdsForRows = Array.from(new Set(rows.map(r => supplierIdMap.get(r.supplierSkuId)!).filter(Boolean)))
  const existingProducts = await prisma.product.findMany({
    where: {
      tenantAdminId: tenantAdminId ?? null,
      supplierSkuId: { in: supplierIdsForRows },
    },
    select: { id: true, supplierSkuId: true },
  })
  const existingProductMap = new Map(existingProducts.map(p => [p.supplierSkuId, p.id]))

  // ─── Step 6: 分流：既有 → update；新的 → createMany ─────────────
  let updated = 0
  const newProductData: ReturnType<typeof buildProductData>[] = []
  for (const row of rows) {
    const supplierId = supplierIdMap.get(row.supplierSkuId)
    if (!supplierId) throw new Error(`找不到 SupplierProduct.id for wmProductId=${row.supplierSkuId}`)
    const data = buildProductData(row, supplierId, tenantAdminId ?? null)
    const existingId = existingProductMap.get(supplierId)
    if (existingId) {
      await prisma.product.update({ where: { id: existingId }, data })
      updated++
    } else {
      newProductData.push(data)
    }
  }

  let created = 0
  if (newProductData.length > 0) {
    const result = await prisma.product.createMany({ data: newProductData })
    created = result.count
  }

  return { count: created + updated, created, updated }
}

function buildProductData(
  row: CsvProductRow,
  supplierId: string,
  tenantAdminId: string | null,
) {
  return {
    ...row,
    supplierSkuId: supplierId,
    tenantAdminId,
  }
}
