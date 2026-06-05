import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { safeDecrypt } from '@/lib/utils/crypto'

// GET /api/liff/payment-config?lineUid=...
// Returns TapPay frontend SDK config for the user's tenant
export async function GET(req: NextRequest) {
  const lineUid = req.nextUrl.searchParams.get('lineUid')

  let tenantAdminId: string | null = null
  if (lineUid) {
    const user = await prisma.user.findUnique({
      where: { lineUid },
      select: {
        ownedGroup: { select: { tenantAdminId: true } },
        groupMembership: { select: { group: { select: { tenantAdminId: true } } } },
      },
    })
    tenantAdminId = user?.ownedGroup?.tenantAdminId
      ?? user?.groupMembership?.group?.tenantAdminId
      ?? null
  }

  // Get TapPay payment config for this tenant
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

  // Fallback to env vars
  return NextResponse.json({
    appId: parseInt(process.env.NEXT_PUBLIC_TAPPAY_APP_ID ?? '0'),
    appKey: process.env.NEXT_PUBLIC_TAPPAY_APP_KEY ?? '',
    env: process.env.NEXT_PUBLIC_TAPPAY_ENV === 'production' ? 'production' : 'sandbox',
  })
}
