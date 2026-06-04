import { NextRequest, NextResponse } from 'next/server'
import { verifySession, SESSION_COOKIE } from '@/lib/auth/session'

// API 路由白名單（不需要驗證）
const PUBLIC_API = ['/api/auth/line']

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // 只保護 /api/* 路由（LIFF 頁面由 client 端處理）
  if (!pathname.startsWith('/api/')) return NextResponse.next()
  if (PUBLIC_API.some(p => pathname.startsWith(p))) return NextResponse.next()

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
