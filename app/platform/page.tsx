'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Stats = {
  totalUsers: number
  totalOrders: number
  totalRevenue: number
  pendingGroups: number
  pendingCommissions: number
  esimPendingOrders: number
}

const STAT_CARDS = (s: Stats) => [
  { label: '總會員數', value: s.totalUsers.toLocaleString(), icon: '👥', href: '/platform/users' },
  { label: '總訂單數', value: s.totalOrders.toLocaleString(), icon: '🧾', href: '/platform/orders' },
  { label: '累計營收', value: `NT$${s.totalRevenue.toLocaleString()}`, icon: '💹', href: '/platform/orders' },
  { label: '待審社群', value: s.pendingGroups, icon: '🏘️', href: '/platform/groups?status=PENDING', alert: s.pendingGroups > 0 },
  { label: '待結算分潤', value: `NT$${s.pendingCommissions.toLocaleString()}`, icon: '💰', href: '/platform/commissions' },
  { label: 'eSIM 待補發', value: s.esimPendingOrders, icon: '⚠️', href: '/platform/orders?status=ESIM_PENDING', alert: s.esimPendingOrders > 0 },
]

export default function PlatformDashboard() {
  const router = useRouter()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/platform/dashboard')
      .then(r => {
        if (r.status === 401) { router.replace('/platform/login'); return null }
        return r.json()
      })
      .then(d => { if (d) setStats(d) })
      .finally(() => setLoading(false))
  }, [router])

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-gray-400">載入中…</p></div>
  if (!stats) return null

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">儀表板</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {STAT_CARDS(stats).map(c => (
          <Link
            key={c.label}
            href={c.href}
            className={`bg-white rounded-2xl border p-5 shadow-sm hover:shadow-md transition flex items-center gap-4 ${c.alert ? 'border-red-300' : ''}`}
          >
            <span className="text-3xl">{c.icon}</span>
            <div>
              <p className="text-xs text-gray-400">{c.label}</p>
              <p className={`text-2xl font-bold ${c.alert ? 'text-red-600' : 'text-gray-800'}`}>{c.value}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
