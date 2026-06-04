import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAuth } from '@/lib/auth/platform'
import { prisma } from '@/lib/db/prisma'
import { PlatformAdminRole } from '@prisma/client'

type Params = { params: Promise<{ id: string }> }

function maskToken(s: string) {
  return s.length > 4 ? `****${s.slice(-4)}` : '****'
}

// GET /api/platform/admins/:id/esim-config
export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requirePlatformAuth(req)
  if (auth instanceof NextResponse) return auth
  if (auth.role !== PlatformAdminRole.SUPER_ADMIN) {
    return NextResponse.json({ error: '權限不足' }, { status: 403 })
  }
  const { id } = await params
  const cfg = await prisma.tenantEsimConfig.findUnique({ where: { adminId: id } })
  if (!cfg) return NextResponse.json({ config: null })
  return NextResponse.json({
    config: {
      id: cfg.id,
      provider: cfg.provider,
      apiUrl: cfg.apiUrl,
      merchantId: cfg.merchantId,
      deptId: cfg.deptId,
      token: maskToken(cfg.token),
      isActive: cfg.isActive,
      updatedAt: cfg.updatedAt,
    },
  })
}

// PUT /api/platform/admins/:id/esim-config
export async function PUT(req: NextRequest, { params }: Params) {
  const auth = await requirePlatformAuth(req)
  if (auth instanceof NextResponse) return auth
  if (auth.role !== PlatformAdminRole.SUPER_ADMIN) {
    return NextResponse.json({ error: '權限不足' }, { status: 403 })
  }
  const { id } = await params
  const body = await req.json()
  const { provider = 'worldmove', apiUrl, merchantId, deptId, token } = body

  if (!apiUrl || !merchantId || !deptId || !token) {
    return NextResponse.json({ error: '請填寫所有必要欄位' }, { status: 400 })
  }

  // If token is masked (starts with ****), keep existing token
  let finalToken = token
  if (token.startsWith('****')) {
    const existing = await prisma.tenantEsimConfig.findUnique({ where: { adminId: id } })
    if (!existing) return NextResponse.json({ error: 'Token 不可為遮罩值（請輸入完整 token）' }, { status: 400 })
    finalToken = existing.token
  }

  try {
    await prisma.tenantEsimConfig.upsert({
      where: { adminId: id },
      create: { adminId: id, provider, apiUrl, merchantId, deptId, token: finalToken },
      update: { provider, apiUrl, merchantId, deptId, token: finalToken, isActive: true },
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 })
  }
}
