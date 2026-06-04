import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminCredentials } from '@/lib/services/platform-admin'
import { createPlatformSession, PLATFORM_COOKIE } from '@/lib/auth/platform'

// POST /api/platform/auth/login
export async function POST(req: NextRequest) {
  const { email, password } = await req.json()

  if (!email || !password) {
    return NextResponse.json({ error: '帳號與密碼必填' }, { status: 400 })
  }

  const admin = await verifyAdminCredentials(email, password)
  if (!admin) {
    return NextResponse.json({ error: '帳號或密碼錯誤' }, { status: 401 })
  }

  const token = await createPlatformSession({
    adminId: admin.id,
    role: admin.role,
  })

  const res = NextResponse.json({
    admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role },
  })

  res.cookies.set(PLATFORM_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 8 * 60 * 60,
    path: '/',
  })

  return res
}
