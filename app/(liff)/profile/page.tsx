'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type UserInfo = {
  id: string
  displayName: string
  avatarUrl: string | null
  profileComplete: boolean
}

export default function ProfilePage() {
  const router = useRouter()
  const [user, setUser] = useState<UserInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.user) setUser(d.user) })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><p className="text-gray-400">載入中…</p></div>
  if (!user) return null

  const MENU = [
    { label: '個人資料', icon: '📋', action: () => router.push('/profile/setup') },
    { label: '我的訂單', icon: '📦', action: () => router.push('/orders') },
    { label: '我的優惠券', icon: '🎫', action: () => router.push('/coupons') },
    { label: '我的社群', icon: '🏘️', action: () => router.push('/group') },
    { label: '客服中心', icon: '💬', action: () => router.push('/support') },
  ]

  return (
    <div className="max-w-lg mx-auto px-4 pt-6">
      {/* 頭像區 */}
      <div className="flex items-center gap-4 mb-6">
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt="" className="w-16 h-16 rounded-full" />
        ) : (
          <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-2xl">👤</div>
        )}
        <div>
          <p className="text-lg font-bold">{user.displayName}</p>
          {!user.profileComplete && (
            <button
              onClick={() => router.push('/profile/setup')}
              className="text-xs text-orange-500 underline mt-0.5"
            >
              ⚠️ 個人資料未填寫，無法結帳
            </button>
          )}
        </div>
      </div>

      {/* 功能選單 */}
      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
        {MENU.map((m, i) => (
          <button
            key={m.label}
            onClick={m.action}
            className={`w-full flex items-center gap-3 px-4 py-4 text-left hover:bg-gray-50 transition ${i > 0 ? 'border-t' : ''}`}
          >
            <span className="text-xl">{m.icon}</span>
            <span className="flex-1 text-sm font-medium text-gray-800">{m.label}</span>
            <span className="text-gray-300 text-sm">›</span>
          </button>
        ))}
      </div>
    </div>
  )
}
