'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'

type AdminInfo = {
  id: string
  name: string
  email: string
  role: string
  tenantAdminId: string | null
}

// 各角色可看到的選單項目
const NAV_ALL = [
  { href: '/platform',             label: '儀表板',   icon: '📊', roles: ['SUPER_ADMIN', 'PLATFORM_ADMIN', 'SUB_ADMIN'] },
  { href: '/platform/users',       label: '會員管理', icon: '👥', roles: ['SUPER_ADMIN', 'PLATFORM_ADMIN'] },
  { href: '/platform/groups',      label: '社群管理', icon: '🏘️', roles: ['SUPER_ADMIN', 'PLATFORM_ADMIN', 'SUB_ADMIN'] },
  { href: '/platform/products',    label: '商品管理', icon: '📦', roles: ['SUPER_ADMIN'] },
  { href: '/platform/orders',      label: '訂單管理', icon: '🧾', roles: ['SUPER_ADMIN', 'PLATFORM_ADMIN', 'SUB_ADMIN'] },
  { href: '/platform/commissions', label: '分潤管理', icon: '💰', roles: ['SUPER_ADMIN', 'PLATFORM_ADMIN', 'SUB_ADMIN'] },
  { href: '/platform/finance',     label: '財務總覽', icon: '📈', roles: ['SUPER_ADMIN'] },
  { href: '/platform/admins',      label: '帳號管理', icon: '🔐', roles: ['SUPER_ADMIN', 'PLATFORM_ADMIN'] },
]

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN:    'Super Admin',
  PLATFORM_ADMIN: 'Platform Admin',
  SUB_ADMIN:      'Sub Admin',
}

const ROLE_COLOR: Record<string, string> = {
  SUPER_ADMIN:    'text-purple-600 bg-purple-50',
  PLATFORM_ADMIN: 'text-blue-600 bg-blue-50',
  SUB_ADMIN:      'text-gray-600 bg-gray-100',
}

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [admin, setAdmin] = useState<AdminInfo | null>(null)

  useEffect(() => {
    if (pathname === '/platform/login') return
    fetch('/api/platform/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) { router.replace('/platform/login'); return }
        setAdmin(d.admin)
      })
      .catch(() => router.replace('/platform/login'))
  }, [pathname, router])

  if (pathname === '/platform/login') return <>{children}</>

  const handleLogout = async () => {
    await fetch('/api/platform/auth/logout', { method: 'POST' })
    router.replace('/platform/login')
  }

  // 根據角色篩選選單
  const nav = admin
    ? NAV_ALL.filter(n => n.roles.includes(admin.role))
    : []

  return (
    <div className="min-h-screen flex bg-gray-100">
      {/* 側邊欄 */}
      <aside className="w-56 bg-white border-r flex-shrink-0 flex flex-col">
        {/* 品牌標題 */}
        <div className="px-5 py-4 border-b">
          <p className="font-bold text-blue-600 text-sm">eSIM 平台後台</p>
        </div>

        {/* 導覽選單 */}
        <nav className="flex-1 py-3">
          {nav.map(n => {
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

        {/* 登入者資訊 + 登出 */}
        <div className="px-5 py-4 border-t space-y-2">
          {admin && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-gray-700 truncate">{admin.name}</p>
              <p className="text-xs text-gray-400 truncate">{admin.email}</p>
              <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLOR[admin.role] ?? 'text-gray-600 bg-gray-100'}`}>
                {ROLE_LABEL[admin.role] ?? admin.role}
              </span>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="text-xs text-gray-400 hover:text-red-500 transition block pt-1"
          >
            登出
          </button>
        </div>
      </aside>

      {/* 主內容 */}
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  )
}
