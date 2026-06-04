'use client'

import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'

const NAV = [
  { href: '/platform', label: '儀表板', icon: '📊' },
  { href: '/platform/users', label: '會員管理', icon: '👥' },
  { href: '/platform/groups', label: '社群管理', icon: '🏘️' },
  { href: '/platform/products', label: '商品管理', icon: '📦' },
  { href: '/platform/orders', label: '訂單管理', icon: '🧾' },
  { href: '/platform/commissions', label: '分潤管理', icon: '💰' },
  { href: '/platform/admins', label: '帳號管理', icon: '🔐' },
]

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  if (pathname === '/platform/login') return <>{children}</>

  const handleLogout = async () => {
    await fetch('/api/platform/auth/logout', { method: 'POST' })
    router.replace('/platform/login')
  }

  return (
    <div className="min-h-screen flex bg-gray-100">
      {/* 側邊欄 */}
      <aside className="w-56 bg-white border-r flex-shrink-0 flex flex-col">
        <div className="px-5 py-4 border-b">
          <p className="font-bold text-blue-600 text-sm">eSIM 平台後台</p>
        </div>
        <nav className="flex-1 py-3">
          {NAV.map(n => {
            const active = pathname === n.href || (n.href !== '/platform' && pathname.startsWith(n.href))
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`flex items-center gap-3 px-5 py-2.5 text-sm transition ${
                  active ? 'bg-blue-50 text-blue-600 font-semibold' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span>{n.icon}</span>
                {n.label}
              </Link>
            )
          })}
        </nav>
        <div className="px-5 py-4 border-t">
          <button onClick={handleLogout} className="text-sm text-gray-400 hover:text-red-500 transition">
            登出
          </button>
        </div>
      </aside>

      {/* 主內容 */}
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  )
}
