import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { safeDecrypt } from '@/lib/utils/crypto'
import { SESSION_COOKIE } from '@/lib/auth/session'
import { resolveTenantAdminIdFromToken } from '@/lib/auth/resolve-tenant'
import { getTenantBySlug } from '@/lib/services/tenant'

// GET /api/liff/payment-config[?lineUid=...]
// Returns TapPay frontend SDK config for the user's tenant.
//
// Tenant resolution priority:
//   1. session JWT 已帶 tenantAdminId（perf #4 之後新 token 都有，零 DB query）
//   2. session JWT 已驗證但沒帶 → fallback prisma.user.findUnique by userId
//   3. 無 session 但有 lineUid query → 用 lineUid 查 user
//   4. 都沒有 → env fallback（部署端可能沒設）
//
// 過去版本只走 lineUid → user.ownedGroup / groupMembership，導致非 group
// 主／非 group 成員的一般使用者 tenantAdminId 永遠是 null、payment-config
// 回 appId=0，前端 setupSDK 失敗 → 信用卡/LINE Pay 卡死「付款中」。
// 改成走 User.tenantAdminId（findOrCreateUser 寫入的那欄）就跟 products
// API 一致。
export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value

  let tenantAdminId: string | null = await resolveTenantAdminIdFromToken(token)

  // 沒 session 但 query 帶了 lineUid → 兜底（讓 LIFF 在 session 還沒建好時也能拿到）
  if (!tenantAdminId) {
    const lineUid = req.nextUrl.searchParams.get('lineUid')
    if (lineUid) {
      const user = await prisma.user.findUnique({
        where: { lineUid },
        select: { tenantAdminId: true },
      })
      tenantAdminId = user?.tenantAdminId ?? null
    }
  }

  // 最後兜底：tenantSlug（桌面開發 / 未登入測試用，例如 /liff/bee/checkout
  // 也能直接 resolve 出 Bee 的 TapPay 設定）
  if (!tenantAdminId) {
    const tenantSlug = req.nextUrl.searchParams.get('tenantSlug')
    if (tenantSlug) {
      const tenant = await getTenantBySlug(tenantSlug)
      tenantAdminId = tenant?.id ?? null
    }
  }

  if (tenantAdminId) {
    const cfg = await prisma.tenantPaymentConfig.findFirst({
      where: { adminId: tenantAdminId, gateway: 'tappay_credit' },
      select: { appId: true, appKey: true, env: true },
    })
    if (cfg?.appId && cfg?.appKey) {
      return NextResponse.json({
        appId: parseInt(cfg.appId),
        appKey: safeDecrypt(cfg.appKey),   // decrypt before sending to frontend SDK
        env: cfg.env === 'production' ? 'production' : 'sandbox',
      })
    }
  }

  // Fallback：env 多半沒設，但保留路徑供本地開發
  return NextResponse.json({
    appId: parseInt(process.env.NEXT_PUBLIC_TAPPAY_APP_ID ?? '0'),
    appKey: process.env.NEXT_PUBLIC_TAPPAY_APP_KEY ?? '',
    env: process.env.NEXT_PUBLIC_TAPPAY_ENV === 'production' ? 'production' : 'sandbox',
  })
}
