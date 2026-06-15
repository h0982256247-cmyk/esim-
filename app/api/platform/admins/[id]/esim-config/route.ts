import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAuth } from '@/lib/auth/platform'
import { prisma } from '@/lib/db/prisma'
import { encrypt, safeDecrypt } from '@/lib/utils/crypto'
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
      // 後台只回遮罩值（先 safeDecrypt 還原再遮罩）；完整 token 永不回傳
      token: maskToken(safeDecrypt(cfg.token)),
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

  // token（機密）：新值 → 加密；遮罩值 → 沿用現有並正規化成加密（encrypt(safeDecrypt(...))
  // 對舊明文值也一併遷移成加密、且不會把已加密值重複加密）
  const existingRow = await prisma.tenantEsimConfig.findUnique({ where: { adminId: id } })
  let finalToken: string
  if (token.startsWith('****')) {
    if (!existingRow) return NextResponse.json({ error: 'Token 不可為遮罩值（請輸入完整 token）' }, { status: 400 })
    finalToken = encrypt(safeDecrypt(existingRow.token))
  } else {
    finalToken = encrypt(token)
  }

  try {
    // 拆 upsert：適配 @prisma/adapter-pg
    if (existingRow) {
      await prisma.tenantEsimConfig.update({
        where: { adminId: id },
        data: { provider, apiUrl, merchantId, deptId, token: finalToken, isActive: true },
      })
    } else {
      await prisma.tenantEsimConfig.create({
        data: { adminId: id, provider, apiUrl, merchantId, deptId, token: finalToken },
      })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 })
  }
}
