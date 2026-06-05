import { NextRequest, NextResponse } from 'next/server'
import { verifyLineIdToken } from '@/lib/auth/line'
import { createSession, SESSION_COOKIE } from '@/lib/auth/session'
import { findOrCreateUser, isProfileComplete } from '@/lib/services/user'
import { getTenantBySlug } from '@/lib/services/tenant'

// POST /api/auth/line
// Body: { idToken: string, tenantSlug?: string }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const idToken: string | undefined = body?.idToken
  const tenantSlug: string | undefined = body?.tenantSlug

  if (!idToken) {
    return NextResponse.json({ error: 'idToken is required' }, { status: 400 })
  }

  let lineInfo
  try {
    lineInfo = await verifyLineIdToken(idToken)
  } catch {
    return NextResponse.json({ error: 'Invalid LINE token' }, { status: 401 })
  }

  // 從 tenantSlug 反查 tenantAdminId
  let tenantAdminId: string | undefined
  if (tenantSlug) {
    const tenant = await getTenantBySlug(tenantSlug)
    tenantAdminId = tenant?.id
  }

  const { user, isNewUser } = await findOrCreateUser(lineInfo, tenantAdminId)
  const profileComplete = isProfileComplete(user)
  const sessionToken = await createSession({ userId: user.id, lineUid: user.lineUid })

  const res = NextResponse.json({
    user: { id: user.id, displayName: user.displayName, avatarUrl: user.avatarUrl, profileComplete },
    isNewUser,
    profileComplete,
  })

  res.cookies.set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  })

  return res
}
