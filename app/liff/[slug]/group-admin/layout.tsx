'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useLiffBase } from '@/hooks/useLiffBase'

// TAB sub-path 只存子路徑（空字串代表 /group-admin 根），render 時拼 base 出來
// 才會帶到正確的 /liff/<slug>/group-admin/<sub>，多租戶下每家走自己的 base。
const TABS: { sub: string; label: string; icon: string }[] = [
  { sub: '',          label: '總覽', icon: '📊' },
  { sub: '/orders',   label: '訂單', icon: '📦' },
  { sub: '/revenue',  label: '收益', icon: '💰' },
  { sub: '/coupons',  label: '發券', icon: '🎫' },
  { sub: '/settings', label: '設定', icon: '⚙️' },
]

export default function GroupAdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const base = useLiffBase()
  const adminRoot = `${base}/group-admin`

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
            const href = `${adminRoot}${t.sub}`
            const active = t.sub === ''
              ? pathname === href
              : pathname === href || pathname.startsWith(`${href}/`)
            return (
              <Link
                key={t.sub || 'root'}
                href={href}
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
