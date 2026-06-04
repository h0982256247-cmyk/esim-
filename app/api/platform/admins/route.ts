import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAuth } from '@/lib/auth/platform'
import { getAllAdmins, createAdmin } from '@/lib/services/platform-admin'
import { PlatformAdminRole } from '@prisma/client'

// GET /api/platform/admins
export async function GET(req: NextRequest) {
  const auth = await requirePlatformAuth(req)
  if (auth instanceof NextResponse) return auth

  if (auth.role !== PlatformAdminRole.SUPER_ADMIN && auth.role !== PlatformAdminRole.PLATFORM_ADMIN) {
    return NextResponse.json({ error: '權限不足' }, { status: 403 })
  }

  const admins = await getAllAdmins(auth.adminId, auth.role)
  return NextResponse.json({ admins })
}

// POST /api/platform/admins — 建立帳號
export async function POST(req: NextRequest) {
  const auth = await requirePlatformAuth(req)
  if (auth instanceof NextResponse) return auth

  const { email, password, name, role, modules } = await req.json()

  if (!email || !password || !name || !role) {
    return NextResponse.json({ error: '必填欄位缺漏' }, { status: 400 })
  }

  // 權限控管：只有 SUPER_ADMIN 可建 PLATFORM_ADMIN；PLATFORM_ADMIN 只能建 SUB_ADMIN
  if (role === PlatformAdminRole.SUPER_ADMIN) {
    return NextResponse.json({ error: '不可建立 Super Admin' }, { status: 403 })
  }
  if (role === PlatformAdminRole.PLATFORM_ADMIN && auth.role !== PlatformAdminRole.SUPER_ADMIN) {
    return NextResponse.json({ error: '只有 Super Admin 可建立 Platform Admin' }, { status: 403 })
  }

  try {
    const admin = await createAdmin({
      email, password, name, role,
      parentId: auth.adminId,
      createdById: auth.adminId,
      modules: modules ?? [],
    })
    return NextResponse.json({ admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role } }, { status: 201 })
  } catch {
    return NextResponse.json({ error: '建立失敗，帳號可能已存在' }, { status: 422 })
  }
}
