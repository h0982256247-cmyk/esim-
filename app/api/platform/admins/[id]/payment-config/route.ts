import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAuth } from '@/lib/auth/platform'
import { prisma } from '@/lib/db/prisma'
import { encrypt, safeDecrypt } from '@/lib/utils/crypto'
import { PlatformAdminRole } from '@prisma/client'

type Params = { params: Promise<{ id: string }> }

function maskKey(s: string) {
  return s.length > 4 ? `****${s.slice(-4)}` : '****'
}

// GET /api/platform/admins/:id/payment-config
export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requirePlatformAuth(req)
  if (auth instanceof NextResponse) return auth
  if (auth.role !== PlatformAdminRole.SUPER_ADMIN) {
    return NextResponse.json({ error: '權限不足' }, { status: 403 })
  }
  const { id } = await params
  const configs = await prisma.tenantPaymentConfig.findMany({ where: { adminId: id } })
  return NextResponse.json({
    configs: configs.map(c => ({
      id: c.id,
      gateway: c.gateway,
      // 後台只回遮罩值（先 safeDecrypt 還原再遮罩，尾碼才正確）；完整 partnerKey 永不回傳
      partnerKey: maskKey(safeDecrypt(c.partnerKey)),
      merchantId: c.merchantId,
      appId: c.appId ?? '',
      appKey: c.appKey ? maskKey(safeDecrypt(c.appKey)) : '',
      env: c.env,
      isActive: c.isActive,
      updatedAt: c.updatedAt,
    })),
  })
}

// PUT /api/platform/admins/:id/payment-config
export async function PUT(req: NextRequest, { params }: Params) {
  const auth = await requirePlatformAuth(req)
  if (auth instanceof NextResponse) return auth
  if (auth.role !== PlatformAdminRole.SUPER_ADMIN) {
    return NextResponse.json({ error: '權限不足' }, { status: 403 })
  }
  const { id } = await params
  const body = await req.json()
  const { gateway, partnerKey, merchantId, env = 'sandbox', appId, appKey } = body

  if (!gateway || !partnerKey) {
    return NextResponse.json({ error: '請填寫所有必要欄位' }, { status: 400 })
  }

  // 既有設定（masked「沿用現有」時取用；用 encrypt(safeDecrypt(...)) 正規化成加密，
  // 對舊明文值也一併遷移成加密、且不會把已加密值重複加密）
  const existing = await prisma.tenantPaymentConfig.findUnique({
    where: { adminId_gateway: { adminId: id, gateway } },
  })

  // partnerKey（必填、機密）：新值 → 加密；遮罩值 → 沿用現有並正規化成加密
  let finalKey: string
  if (partnerKey.startsWith('****')) {
    if (!existing) return NextResponse.json({ error: 'Partner Key 不可為遮罩值' }, { status: 400 })
    finalKey = encrypt(safeDecrypt(existing.partnerKey))
  } else {
    finalKey = encrypt(partnerKey)
  }

  // appKey（前端 client key，可回傳給前端使用；at-rest 仍加密以求一致）：
  //   空 → 不變更；遮罩 → 沿用現有；新值 → 加密
  let finalAppKey: string | undefined
  if (!appKey) {
    finalAppKey = undefined
  } else if (appKey.startsWith('****')) {
    finalAppKey = existing?.appKey ? encrypt(safeDecrypt(existing.appKey)) : undefined
  } else {
    finalAppKey = encrypt(appKey)
  }

  try {
    // 拆 upsert：適配 @prisma/adapter-pg
    if (existing) {
      await prisma.tenantPaymentConfig.update({
        where: { adminId_gateway: { adminId: id, gateway } },
        data: { partnerKey: finalKey, merchantId, env, appId: appId || undefined, appKey: finalAppKey, isActive: true },
      })
    } else {
      await prisma.tenantPaymentConfig.create({
        data: { adminId: id, gateway, partnerKey: finalKey, merchantId, env, appId: appId || undefined, appKey: finalAppKey },
      })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 })
  }
}
