import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAuth } from '@/lib/auth/platform'
import { prisma } from '@/lib/db/prisma'
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
      partnerKey: maskKey(c.partnerKey),
      merchantId: c.merchantId,
      appId: c.appId ?? '',
      appKey: c.appKey ? maskKey(c.appKey) : '',
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

  let finalKey = partnerKey
  if (partnerKey.startsWith('****')) {
    const existing = await prisma.tenantPaymentConfig.findFirst({ where: { adminId: id, gateway } })
    if (!existing) return NextResponse.json({ error: 'Partner Key 不可為遮罩值' }, { status: 400 })
    finalKey = existing.partnerKey
  }

  // Handle masked appKey
  let finalAppKey: string | undefined = appKey || undefined
  if (appKey && appKey.startsWith('****')) {
    const existing = await prisma.tenantPaymentConfig.findFirst({ where: { adminId: id, gateway } })
    finalAppKey = existing?.appKey ?? undefined
  }

  try {
    // 拆 upsert：適配 @prisma/adapter-pg
    const existingRow = await prisma.tenantPaymentConfig.findUnique({
      where: { adminId_gateway: { adminId: id, gateway } },
    })
    if (existingRow) {
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
