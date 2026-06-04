import { NextRequest, NextResponse } from 'next/server'
import { verifyLineIdToken } from '@/lib/auth/line'
import { createSession, SESSION_COOKIE } from '@/lib/auth/session'
import { findOrCreateUser, isProfileComplete } from '@/lib/services/user'

// POST /api/auth/line
// Body: { idToken: string }
// Returns: { user, isNewUser, profileComplete }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const idToken: string | undefined = body?.idToken

  if (!idToken) {
    return NextResponse.json({ error: 'idToken is required' }, { status: 400 })
  }

  let lineInfo
  try {
    lineInfo = await verifyLineIdToken(idToken)
  } catch {
    return NextResponse.json({ error: 'Invalid LINE token' }, { status: 401 })
  }

  const { user, isNewUser } = await findOrCreateUser(lineInfo)
  const profileComplete = isProfileComplete(user)
  const sessionToken = await createSession({ userId: user.id, lineUid: user.lineUid })

  const res = NextResponse.json({
    user: {
      id: user.id,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      profileComplete,
    },
    isNewUser,
    profileComplete,
  })

  res.cookies.set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  })

  return res
}
