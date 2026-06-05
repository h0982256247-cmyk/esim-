import { prisma } from '@/lib/db/prisma'
import { ProductStatus, SupplierProductType } from '@prisma/client'

export async function getActiveProducts(countryCode?: string, tenantAdminId?: string | null) {
  return prisma.product.findMany({
    where: {
      status: ProductStatus.ACTIVE,
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
      status: true,
      supplierSkuId: true,
    },
  })
}

export async function getAvailableCountries(tenantAdminId?: string | null) {
  const products = await prisma.product.findMany({
    where: {
      status: ProductStatus.ACTIVE,
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
        select: { wmProductId: true, productName: true, status: true },
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

// All-or-nothing: any DB error rolls back the entire batch
export async function batchCreateProducts(rows: CsvProductRow[], tenantAdminId?: string | null): Promise<{ count: number }> {
  return prisma.$transaction(async tx => {
    let count = 0
    for (const row of rows) {
      // SupplierProduct 以 wmProductId = supplierSkuId 做 upsert
      // 若供應商目錄中已有此 SKU 則沿用，否則自動建立 stub 記錄
      const supplierProduct = await tx.supplierProduct.upsert({
        where:  { wmProductId: row.supplierSkuId },
        update: {},   // 已存在則不覆蓋任何欄位
        create: {
          wmProductId: row.supplierSkuId,
          productName: row.countryNameZh || row.supplierSkuId,
          productType: SupplierProductType.ESIM,
          costPrice:   row.costPrice,
        },
      })

      await tx.product.create({
        data: {
          ...row,
          supplierSkuId: supplierProduct.id,   // 使用 SupplierProduct 的 cuid
          tenantAdminId: tenantAdminId ?? null,
        },
      })
      count++
    }
    return { count }
  })
}
