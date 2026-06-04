import { NextRequest, NextResponse } from 'next/server'
import { verifySession, SESSION_COOKIE } from '@/lib/auth/session'
import { verifyPlatformSession, PLATFORM_COOKIE } from '@/lib/auth/platform'

// 完全公開（無需任何驗證）
const PUBLIC_API = ['/api/auth/line', '/api/tenant/', '/api/platform/auth/']

// 平台後台路由前綴（使用 PLATFORM_COOKIE 驗證）
// /api/platform/* 為新式命名；/api/admin/* 為舊式命名，路由內部同樣使用 requirePlatformAuth
const isPlatformRoute = (p: string) =>
  p.startsWith('/api/platform/') || p.startsWith('/api/admin/')

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // 只保護 /api/* 路由（LIFF 頁面由 client 端處理）
  if (!pathname.startsWith('/api/')) return NextResponse.next()

  // 白名單放行
  if (PUBLIC_API.some(p => pathname.startsWith(p))) return NextResponse.next()

  // 平台後台路由 → 驗證 PLATFORM_COOKIE
  if (isPlatformRoute(pathname)) {
    const token = req.cookies.get(PLATFORM_COOKIE)?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    try {
      await verifyPlatformSession(token)
      return NextResponse.next()
    } catch {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }
  }

  // 一般 LIFF 使用者路由 → 驗證 SESSION_COOKIE
  const token = req.cookies.get(SESSION_COOKIE)?.value
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    await verifySession(token)
    return NextResponse.next()
  } catch {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
  }
}

export const config = {
  matcher: ['/api/:path*'],
}
