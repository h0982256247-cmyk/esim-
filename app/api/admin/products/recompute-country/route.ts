import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAuth } from '@/lib/auth/platform'
import { recomputeCountriesFromSupplier } from '@/lib/services/product'

// PgBouncer connection_limit=1 下 bulk UPDATE 仍要花 10-20 秒在 11k+ 列規模上。
// 10 秒預設 timeout 不夠，拉到 60 秒。
export const maxDuration = 60

// POST /api/admin/products/recompute-country
// 用 SupplierProduct.productName 重新解析所有 Product 的國家。
export async function POST(req: NextRequest) {
  const auth = await requirePlatformAuth(req)
  if (auth instanceof NextResponse) return auth

  try {
    const result = await recomputeCountriesFromSupplier(auth.tenantAdminId)
    return NextResponse.json({
      message: `重算完成：共 ${result.total} 筆，更新 ${result.updated} 筆，未變更 ${result.skipped} 筆`,
      ...result,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '重算失敗'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
