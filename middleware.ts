import { NextResponse, type NextRequest } from 'next/server'

// 把舊版 (liff) 路由群組刪掉之後，舊的 deep link（例如 /products /orders/<id>
// /checkout）不再有對應的路由。為了不讓使用者撞到 Next.js 預設 404，把這些
// 舊路徑 302 redirect 到主網域的後台登入頁，並用 ?from=<舊路徑> 帶過去，
// 登入頁能顯示一段「您剛從 X 被導離」的友善說明。
//
// LIFF 流程現在一律走 /liff/<slug>/...，所有租戶設定（金流、發票、eSIM）
// 都跟著 slug，因此本 middleware 不需要解 tenant、單純做路徑 redirect 即可。

const OLD_LIFF_PATHS = [
  '/products',
  '/orders',
  '/checkout',
  '/profile',
  '/coupons',
  '/group',
  '/support',
  '/gift',
  '/group-admin',  // 已搬到 /liff/<slug>/group-admin；舊 bookmark 走這條 redirect
]

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl

  // 只攔截剛好開頭等於舊路徑的請求（避免誤殺 /orders/.../<sub> 以外的東西）
  // 任何子路徑 e.g. /products/abc /orders/xyz /gift/<token> 都會 match。
  const hit = OLD_LIFF_PATHS.some(
    p => pathname === p || pathname.startsWith(`${p}/`)
  )
  if (!hit) return NextResponse.next()

  const url = req.nextUrl.clone()
  url.pathname = '/'
  // 把使用者原本想去的路徑用 query 傳給登入頁顯示
  url.searchParams.set('from', pathname + (search ?? ''))
  return NextResponse.redirect(url, 302)
}

// 用 matcher 把不該攔截的路徑排除，省 middleware 運算量
export const config = {
  matcher: [
    // 排除 next 內部、靜態檔、liff、platform、api。group-admin 已搬到
    // /liff/<slug>/group-admin，這裡刻意不排除，讓中介層攔到舊書籤導去登入頁。
    '/((?!_next/|api/|liff/|platform/|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)).*)',
  ],
}
