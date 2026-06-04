'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

type Tab = {
  href: string
  label: string
  icon: string
  ownerOnly?: boolean
}

const TABS: Tab[] = [
  { href: '/products', label: '購買', icon: '🌏' },
  { href: '/orders', label: '訂單', icon: '📦' },
  { href: '/coupons', label: '優惠券', icon: '🎫' },
  { href: '/group', label: '社群', icon: '🏘️' },
  { href: '/profile', label: '我的', icon: '👤' },
]

const GROUP_ADMIN_TAB: Tab = { href: '/group-admin', label: '後台', icon: '⚙️', ownerOnly: true }

export default function LiffBottomNav() {
  const pathname = usePathname()
  const [isGroupOwner, setIsGroupOwner] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.ownedGroup?.status === 'APPROVED') setIsGroupOwner(true) })
      .catch(() => {})
  }, [])

  const tabs = isGroupOwner ? [...TABS, GROUP_ADMIN_TAB] : TABS

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t z-50">
      <div className="max-w-lg mx-auto flex">
        {tabs.map(t => {
          const active = pathname === t.href || (t.href !== '/' && pathname.startsWith(t.href))
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`flex-1 flex flex-col items-center py-2 text-xs transition ${active ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <span className="text-xl mb-0.5">{t.icon}</span>
              {t.label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
