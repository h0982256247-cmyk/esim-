import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAuth } from '@/lib/auth/platform'
import { toggleAdminActive, updateAdminPassword } from '@/lib/services/platform-admin'
import { PlatformAdminRole } from '@prisma/client'

type Params = { params: Promise<{ id: string }> }

// PATCH /api/platform/admins/:id  — toggle active or change password
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

  return NextResponse.json({ error: '無效請求' }, { status: 400 })
}
