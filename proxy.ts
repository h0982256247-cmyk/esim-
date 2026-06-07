import { NextRequest, NextResponse } from 'next/server'
import { verifySession, SESSION_COOKIE } from '@/lib/auth/session'
import { verifyPlatformSession, PLATFORM_COOKIE } from '@/lib/auth/platform'

// 完全公開（無需任何驗證）
//   /api/auth/line        — LINE 登入用
//   /api/tenant/          — Tenant 公開設定（前台讀取品牌、模板等）
//   /api/platform/auth/   — Platform admin 登入
//   /api/webhooks/        — 第三方 (WM 等) push 過來的 callback，由 route 內部驗證 payload
//   /api/cron/            — Vercel Cron，由 route 內部驗證 CRON_SECRET
//   /api/gifts/           — 轉贈連結預覽 (GET 不需登入)；claim 子路徑由 route 內部驗 session
const PUBLIC_API = [
  '/api/auth/line',
  '/api/tenant/',
  '/api/platform/auth/',
  '/api/webhooks/',
  '/api/cron/',
  '/api/gifts/',
]

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
