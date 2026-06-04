'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'

const TABS = [
  { href: '/group-admin', label: '總覽', icon: '📊' },
  { href: '/group-admin/orders', label: '訂單', icon: '📦' },
  { href: '/group-admin/revenue', label: '收益', icon: '💰' },
  { href: '/group-admin/coupons', label: '發券', icon: '🎫' },
  { href: '/group-admin/settings', label: '設定', icon: '⚙️' },
]

export default function GroupAdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto">
        <div className="bg-white border-b px-4 py-3 flex items-center gap-2">
          <span className="text-sm font-semibold text-blue-600">社群主後台</span>
        </div>
        <div className="pb-20">{children}</div>
      </div>
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t">
        <div className="max-w-lg mx-auto flex">
          {TABS.map(t => {
            const active = pathname === t.href || (t.href !== '/group-admin' && pathname.startsWith(t.href))
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`flex-1 flex flex-col items-center py-2 text-xs transition ${active ? 'text-blue-600' : 'text-gray-400'}`}
              >
                <span className="text-lg">{t.icon}</span>
                {t.label}
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
