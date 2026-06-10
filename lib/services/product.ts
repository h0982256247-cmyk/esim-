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

// 批次匯入：用 4 個 batched query 取代 N×3 query loop
//
// DATABASE_URL 走 PgBouncer connection_limit=1，loop 內每個 await 都要排隊，
// 50 列以上 transaction 必爆。改用 createMany 批次寫入：
//   1. findMany 取出 CSV 中已存在的 SupplierProduct
//   2. createMany 一次寫入所有新的 SupplierProduct（skipDuplicates 防競態）
//   3. 再 findMany 拿到所有 SupplierProduct.id 對照表
//   4. createMany 批次寫入 Product
//
// 不用 $transaction：失敗會留 orphan SupplierProduct，但這些是合法資料、可被
// 之後的匯入引用，不傷害一致性。寧可放棄 strict atomicity 換取速度。
export async function batchCreateProducts(
  rows: CsvProductRow[],
  tenantAdminId?: string | null,
  supplierMap?: SupplierProductMap,
): Promise<{ count: number }> {
  if (rows.length === 0) return { count: 0 }

  // 唯一化 wmProductId（CSV 同 SKU 多列）
  const wmIds = Array.from(new Set(rows.map(r => r.supplierSkuId)))

  // 1. 先抓已存在的 SupplierProduct
  const existing = await prisma.supplierProduct.findMany({
    where: { wmProductId: { in: wmIds } },
    select: { id: true, wmProductId: true },
  })
  const existingSet = new Set(existing.map(s => s.wmProductId))

  // 2. 組裝新 SupplierProduct 的資料
  const newSupplierData = wmIds
    .filter(id => !existingSet.has(id))
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

  // 3. createMany 寫入新 SupplierProduct
  if (newSupplierData.length > 0) {
    await prisma.supplierProduct.createMany({
      data: newSupplierData,
      skipDuplicates: true,
    })
  }

  // 4. 再查一次拿全部 id（含剛 createMany 的）
  const allSuppliers = await prisma.supplierProduct.findMany({
    where: { wmProductId: { in: wmIds } },
    select: { id: true, wmProductId: true },
  })
  const supplierIdMap = new Map(allSuppliers.map(s => [s.wmProductId, s.id]))

  // 5. 組裝並 createMany Product
  const productData = rows.map(row => {
    const supplierId = supplierIdMap.get(row.supplierSkuId)
    if (!supplierId) {
      throw new Error(`找不到 SupplierProduct.id for wmProductId=${row.supplierSkuId}`)
    }
    return {
      ...row,
      supplierSkuId: supplierId,
      tenantAdminId: tenantAdminId ?? null,
    }
  })

  const result = await prisma.product.createMany({
    data: productData,
  })

  return { count: result.count }
}
