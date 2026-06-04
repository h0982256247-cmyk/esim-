'use client'

import { useEffect, useState } from 'react'

type Coupon = {
  id: string
  type: string
  level: 'A' | 'B' | 'C'
  discount: number
  isOfficial: boolean
  expiresAt: string | null
  usedAt: string | null
  createdAt: string
}

const TYPE_LABEL: Record<string, string> = {
  OFFICIAL_WELCOME: '歡迎券',
  GROUP_JOIN: '入群券',
  GROUP_REPURCHASE: '回購券',
  GROUP_OWNER: '社群主專屬',
  GROUP_ACTIVITY: '活動券',
}

const LEVEL_COLOR: Record<string, string> = {
  A: 'bg-red-100 text-red-700',
  B: 'bg-orange-100 text-orange-700',
  C: 'bg-blue-100 text-blue-700',
}

function discountLabel(d: number) {
  return `${Math.round((1 - d) * 100)}% OFF`
}

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'available' | 'used'>('available')

  useEffect(() => {
    fetch('/api/coupons')
      .then(r => r.json())
      .then(d => setCoupons(d.coupons ?? []))
      .finally(() => setLoading(false))
  }, [])

  const now = new Date()
  const available = coupons.filter(c => !c.usedAt && (!c.expiresAt || new Date(c.expiresAt) > now))
  const used = coupons.filter(c => c.usedAt || (c.expiresAt && new Date(c.expiresAt) <= now))

  const list = tab === 'available' ? available : used

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><p className="text-gray-500">載入中…</p></div>
  }

  return (
    <div className="max-w-lg mx-auto pb-24">
      <div className="px-4 pt-6 pb-2">
        <h1 className="text-xl font-bold mb-4">我的優惠券</h1>
        <div className="flex border-b">
          {(['available', 'used'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 pb-2 text-sm font-medium transition border-b-2 ${
                tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400'
              }`}
            >
              {t === 'available' ? `可使用（${available.length}）` : `已使用 / 過期（${used.length}）`}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-3 space-y-3">
        {list.length === 0 && (
          <p className="text-center text-gray-400 py-10">
            {tab === 'available' ? '目前沒有可使用的優惠券' : '沒有使用紀錄'}
          </p>
        )}
        {list.map(c => (
          <div
            key={c.id}
            className={`bg-white rounded-xl border p-4 shadow-sm ${c.usedAt ? 'opacity-50' : ''}`}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${LEVEL_COLOR[c.level]}`}>
                    {c.level} 級券
                  </span>
                  {c.isOfficial && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">官方</span>
                  )}
                </div>
                <p className="font-semibold text-gray-800">{TYPE_LABEL[c.type] ?? c.type}</p>
                {c.expiresAt && (
                  <p className="text-xs text-gray-400 mt-1">
                    有效至 {new Date(c.expiresAt).toLocaleDateString('zh-TW')}
                  </p>
                )}
                {c.usedAt && (
                  <p className="text-xs text-gray-400 mt-1">
                    已於 {new Date(c.usedAt).toLocaleDateString('zh-TW')} 使用
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-2xl font-extrabold text-blue-600">{discountLabel(c.discount)}</p>
                <p className="text-xs text-gray-400">{Math.round(c.discount * 10)} 折</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
