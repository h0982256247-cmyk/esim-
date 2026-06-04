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
  const { gateway, partnerKey, merchantId, env = 'sandbox' } = body

  if (!gateway || !partnerKey || !merchantId) {
    return NextResponse.json({ error: '請填寫所有必要欄位' }, { status: 400 })
  }

  let finalKey = partnerKey
  if (partnerKey.startsWith('****')) {
    const existing = await prisma.tenantPaymentConfig.findFirst({ where: { adminId: id, gateway } })
    if (!existing) return NextResponse.json({ error: 'Partner Key 不可為遮罩值' }, { status: 400 })
    finalKey = existing.partnerKey
  }

  try {
    await prisma.tenantPaymentConfig.upsert({
      where: { adminId_gateway: { adminId: id, gateway } },
      create: { adminId: id, gateway, partnerKey: finalKey, merchantId, env },
      update: { partnerKey: finalKey, merchantId, env, isActive: true },
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 })
  }
}
