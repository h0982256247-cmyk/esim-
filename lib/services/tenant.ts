import { prisma } from '@/lib/db/prisma'
import type { TenantConfig } from '@/components/liff/TenantContext'

export type { TenantConfig }

export async function getTenantBySlug(slug: string): Promise<TenantConfig | null> {
  const admin = await prisma.platformAdmin.findUnique({
    where: { tenantSlug: slug, isActive: true },
    select: { id: true, tenantSlug: true, brandName: true, liffId: true, logoUrl: true, primaryColor: true, homeTemplate: true, productsTemplate: true },
  })

  if (!admin || !admin.tenantSlug || !admin.brandName || !admin.liffId) return null

  return {
    id: admin.id,
    slug: admin.tenantSlug,
    brandName: admin.brandName,
    liffId: admin.liffId,
    logoUrl: admin.logoUrl,
    primaryColor: admin.primaryColor,
    homeTemplate: (admin.homeTemplate as TenantConfig['homeTemplate']) ?? null,
    productsTemplate: (admin.productsTemplate as TenantConfig['productsTemplate']) ?? null,
  }
}

// 非 slug 的單租戶部署（用環境變數 NEXT_PUBLIC_LIFF_ID 綁定）靠 liffId 反查後台
// 品牌設定，用來設定頁面標題等。liffId 理論上對應單一後台，取第一筆即可。
export async function getTenantByLiffId(liffId: string): Promise<TenantConfig | null> {
  if (!liffId) return null
  const admin = await prisma.platformAdmin.findFirst({
    where: { liffId, isActive: true },
    select: { id: true, tenantSlug: true, brandName: true, liffId: true, logoUrl: true, primaryColor: true, homeTemplate: true, productsTemplate: true },
  })

  if (!admin || !admin.tenantSlug || !admin.brandName || !admin.liffId) return null

  return {
    id: admin.id,
    slug: admin.tenantSlug,
    brandName: admin.brandName,
    liffId: admin.liffId,
    logoUrl: admin.logoUrl,
    primaryColor: admin.primaryColor,
    homeTemplate: (admin.homeTemplate as TenantConfig['homeTemplate']) ?? null,
    productsTemplate: (admin.productsTemplate as TenantConfig['productsTemplate']) ?? null,
  }
}

export async function getTenantById(tenantAdminId: string): Promise<TenantConfig | null> {
  const admin = await prisma.platformAdmin.findUnique({
    where: { id: tenantAdminId, isActive: true },
    select: { id: true, tenantSlug: true, brandName: true, liffId: true, logoUrl: true, primaryColor: true, homeTemplate: true, productsTemplate: true },
  })

  if (!admin || !admin.tenantSlug || !admin.brandName || !admin.liffId) return null

  return {
    id: admin.id,
    slug: admin.tenantSlug,
    brandName: admin.brandName,
    liffId: admin.liffId,
    logoUrl: admin.logoUrl,
    primaryColor: admin.primaryColor,
    homeTemplate: (admin.homeTemplate as TenantConfig['homeTemplate']) ?? null,
    productsTemplate: (admin.productsTemplate as TenantConfig['productsTemplate']) ?? null,
  }
}
