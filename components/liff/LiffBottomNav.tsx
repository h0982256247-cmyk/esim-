'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

const S = { accent: '#0284c7', inactive: '#94a3b8', adminAccent: '#b45309' }

function IconShop({ active }: { active?: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  )
}

function IconOrders({ active }: { active?: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  )
}

function IconCoupon({ active }: { active?: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  )
}

function IconProfile({ active }: { active?: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

function IconAdmin({ active }: { active?: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  )
}

const TAB_PATHS = ['products', 'orders', 'coupons', 'profile']
const ADMIN_PATH = 'group-admin'

type TabDef = { path: string; label: string; Icon: React.FC<{ active?: boolean }>; ownerOnly?: boolean }

const TABS: TabDef[] = [
  { path: 'products', label: '購買',  Icon: IconShop },
  { path: 'orders',   label: '訂單',  Icon: IconOrders },
  { path: 'coupons',  label: '優惠券', Icon: IconCoupon },
  { path: 'profile',  label: '我的',  Icon: IconProfile },
]

const ADMIN_TAB: TabDef = { path: ADMIN_PATH, label: '後台', Icon: IconAdmin, ownerOnly: true }

// 從 pathname 偵測是否在 /liff/[slug]/ 路由，並回傳 base prefix
function useBasePath() {
  const pathname = usePathname()
  // /liff/slug/xxx → prefix = /liff/slug
  const slugMatch = pathname.match(/^(\/liff\/[^/]+)/)
  if (slugMatch) return slugMatch[1]
  return ''
}

export default function LiffBottomNav() {
  const pathname = usePathname()
  const base = useBasePath()
  const [isGroupOwner, setIsGroupOwner] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.ownedGroup?.status === 'APPROVED') setIsGroupOwner(true) })
      .catch(() => {})
  }, [])

  const tabs = isGroupOwner ? [...TABS, ADMIN_TAB] : TABS

  return (
    <div
      style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
        background: 'rgba(255,255,255,0.97)',
        backdropFilter: 'blur(16px)',
        borderTop: '1px solid rgba(0,0,0,0.07)',
      }}
    >
      <div style={{ maxWidth: 520, margin: '0 auto', display: 'flex', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {tabs.map(({ path, label, Icon, ownerOnly }) => {
          const href = `${base}/${path}`
          const active = pathname === href || pathname.startsWith(href + '/')
          const color = active ? (ownerOnly ? S.adminAccent : S.accent) : S.inactive
          return (
            <Link
              key={path}
              href={href}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 3,
                paddingTop: 10,
                paddingBottom: 10,
                color,
                textDecoration: 'none',
                transition: 'color 0.15s',
              }}
            >
              <Icon active={active} />
              <span style={{ fontSize: 10, fontWeight: active ? 700 : 500, letterSpacing: '0.02em', lineHeight: 1 }}>
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
