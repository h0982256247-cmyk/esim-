import { prisma } from '@/lib/db/prisma'
import { ProductStatus } from '@prisma/client'

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
  countryCode: string
  countryNameZh: string
  countryNameEn: string
  countryFlag?: string | null
  displayDays: number
  dataCapacity?: string | null
  description?: string | null
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
  countryCode: string
  countryNameZh: string
  countryNameEn: string
  countryFlag?: string
  displayDays: number
  dataCapacity?: string
  description?: string
  sellPrice: number
  costPrice: number
  sortOrder?: number
}

// All-or-nothing: any DB error rolls back the entire batch
export async function batchCreateProducts(rows: CsvProductRow[], tenantAdminId?: string | null): Promise<{ count: number }> {
  return prisma.$transaction(async tx => {
    let count = 0
    for (const row of rows) {
      await tx.product.create({ data: { ...row, tenantAdminId: tenantAdminId ?? null } })
      count++
    }
    return { count }
  })
}
