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

export async function getAllProductsAdmin(tenantAdminId?: string | null) {
  return prisma.product.findMany({
    where: tenantAdminId ? { tenantAdminId } : undefined,
    orderBy: [{ countryCode: 'asc' }, { displayDays: 'asc' }],
    include: {
      supplierProduct: {
        select: { wmProductId: true, productName: true, status: true, lastSyncAt: true },
      },
    },
  })
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

// All-or-nothing: any DB error rolls back the entire batch
// 若有提供 supplierMap（由 myQueryAll 取回），SupplierProduct 會以供應商真實資料為準寫入/覆蓋
export async function batchCreateProducts(
  rows: CsvProductRow[],
  tenantAdminId?: string | null,
  supplierMap?: SupplierProductMap,
): Promise<{ count: number }> {
  return prisma.$transaction(async tx => {
    let count = 0
    const now = new Date()

    for (const row of rows) {
      const wmInfo = supplierMap?.get(row.supplierSkuId)

      // 只動「必填 + 一定存在於 DB」的核心欄位，避免 schema/DB drift 時 crash。
      // 其餘可選欄位 (productId / productRegion / isEsim / status / lastSyncAt) 走 schema 預設值。
      // 之後若想同步 WM 更多 metadata，建議建立獨立的 sync job 避免影響匯入流程。
      const productName = wmInfo?.productName ?? (row.countryNameZh || row.supplierSkuId)
      const productType = wmInfo
        ? (WM_PRODUCT_TYPE_MAP[wmInfo.productType] ?? SupplierProductType.ESIM)
        : SupplierProductType.ESIM
      const costPrice = wmInfo?.productPrice ?? row.costPrice

      // 注意：原本用 upsert，但 @prisma/adapter-pg 在某些情境會回傳 raw rows array `[]` 而非物件，
      //       拆成明確的 findUnique → create / update 規避此 adapter bug。
      let supplierProduct = await tx.supplierProduct.findUnique({
        where: { wmProductId: row.supplierSkuId },
      })

      if (supplierProduct) {
        if (wmInfo) {
          // 從 WM 拿到新資料 → 更新
          supplierProduct = await tx.supplierProduct.update({
            where: { id: supplierProduct.id },
            data: { productName, productType, costPrice },
          })
        }
        // 沒 wmInfo → 沿用既有，不動
      } else {
        supplierProduct = await tx.supplierProduct.create({
          data: {
            wmProductId: row.supplierSkuId,
            productName,
            productType,
            costPrice,
          },
        })
      }

      if (!supplierProduct?.id) {
        throw new Error(
          `SupplierProduct findUnique/create/update 回傳無效記錄（wmProductId=${row.supplierSkuId}）。` +
          `Got: ${JSON.stringify(supplierProduct)}`,
        )
      }

      await tx.product.create({
        data: {
          ...row,
          supplierSkuId: supplierProduct.id,
          tenantAdminId: tenantAdminId ?? null,
        },
      })
      count++
    }
    return { count }
  })
}
