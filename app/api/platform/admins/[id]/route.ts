import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAuth } from '@/lib/auth/platform'
import { toggleAdminActive, updateAdminPassword, updateMaxRebateRate } from '@/lib/services/platform-admin'
import { PlatformAdminRole } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { encrypt, safeDecrypt } from '@/lib/utils/crypto'

type Params = { params: Promise<{ id: string }> }

// GET /api/platform/admins/:id  — fetch a single Platform Admin (SUPER_ADMIN only)
export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requirePlatformAuth(req)
  if (auth instanceof NextResponse) return auth

  if (auth.role !== PlatformAdminRole.SUPER_ADMIN) {
    return NextResponse.json({ error: '權限不足' }, { status: 403 })
  }

  const { id } = await params
  const admin = await prisma.platformAdmin.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      createdAt: true,
      maxRebateRate: true,
      tenantSlug: true,
      brandName: true,
      logoUrl: true,
      primaryColor: true,
      lineAccessToken: true,
      _count: { select: { ownedGroups: true } },
    },
  })

  if (!admin) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Mask lineAccessToken before returning — never expose plaintext to frontend
  return NextResponse.json({
    admin: {
      ...admin,
      lineAccessToken: admin.lineAccessToken
        ? '****' + safeDecrypt(admin.lineAccessToken).slice(-4)
        : null,
    },
  })
}

// PATCH /api/platform/admins/:id  — toggle active, change password, or set maxRebateRate
export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requirePlatformAuth(req)
  if (auth instanceof NextResponse) return auth

  if (auth.role !== PlatformAdminRole.SUPER_ADMIN && auth.role !== PlatformAdminRole.PLATFORM_ADMIN) {
    return NextResponse.json({ error: '權限不足' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()

  if (typeof body.isActive === 'boolean') {
    await toggleAdminActive(id, body.isActive)
    return NextResponse.json({ ok: true })
  }

  if (body.newPassword) {
    await updateAdminPassword(id, body.newPassword)
    return NextResponse.json({ ok: true })
  }

  // 僅 SUPER_ADMIN 可設定讓利上限
  if (typeof body.maxRebateRate === 'number') {
    if (auth.role !== PlatformAdminRole.SUPER_ADMIN) {
      return NextResponse.json({ error: '只有 Super Admin 可設定讓利上限' }, { status: 403 })
    }
    try {
      await updateMaxRebateRate(id, body.maxRebateRate)
      return NextResponse.json({ ok: true })
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 400 })
    }
  }

  if (body.brandName !== undefined || body.tenantSlug !== undefined || body.logoUrl !== undefined || body.primaryColor !== undefined || body.lineAccessToken !== undefined) {
    const updateData: Record<string, unknown> = {}
    if (body.brandName !== undefined) updateData.brandName = body.brandName
    if (body.tenantSlug !== undefined) updateData.tenantSlug = body.tenantSlug
    if (body.logoUrl !== undefined) updateData.logoUrl = body.logoUrl
    if (body.primaryColor !== undefined) updateData.primaryColor = body.primaryColor
    if (body.lineAccessToken !== undefined) {
      // If masked value passed back, keep existing encrypted value
      if (body.lineAccessToken && body.lineAccessToken.startsWith('****')) {
        const existing = await prisma.platformAdmin.findUnique({ where: { id }, select: { lineAccessToken: true } })
        updateData.lineAccessToken = existing?.lineAccessToken ?? null
      } else {
        updateData.lineAccessToken = body.lineAccessToken ? encrypt(body.lineAccessToken) : null
      }
    }
    try {
      await prisma.platformAdmin.update({ where: { id }, data: updateData })
      return NextResponse.json({ ok: true })
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 400 })
    }
  }

  return NextResponse.json({ error: '無效請求' }, { status: 400 })
}

// DELETE /api/platform/admins/:id — 移除帳號（僅 SUPER_ADMIN，不可刪自己或其他 SUPER_ADMIN）
export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requirePlatformAuth(req)
  if (auth instanceof NextResponse) return auth

  if (auth.role !== PlatformAdminRole.SUPER_ADMIN) {
    return NextResponse.json({ error: '只有 Super Admin 可移除帳號' }, { status: 403 })
  }

  const { id } = await params

  if (id === auth.adminId) {
    return NextResponse.json({ error: '不可刪除自己的帳號' }, { status: 400 })
  }

  const target = await prisma.platformAdmin.findUnique({
    where: { id },
    select: { role: true, _count: { select: { ownedGroups: true } } },
  })

  if (!target) return NextResponse.json({ error: '帳號不存在' }, { status: 404 })

  if (target.role === PlatformAdminRole.SUPER_ADMIN) {
    return NextResponse.json({ error: '不可刪除 Super Admin 帳號' }, { status: 400 })
  }

  if (target._count.ownedGroups > 0) {
    return NextResponse.json({ error: '此帳號仍有關聯社群，請先移轉或刪除社群後再移除帳號' }, { status: 400 })
  }

  try {
    await prisma.platformAdmin.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 })
  }
}
