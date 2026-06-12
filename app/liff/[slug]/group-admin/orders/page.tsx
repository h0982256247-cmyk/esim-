'use client'

import { useEffect, useState } from 'react'

type Commission = {
  id: string
  commissionAmount: number
  paidAmount: number
  status: string
  createdAt: string
  order: {
    id: string
    paidAt: string | null
    orderItems: { productName: string }[]
  }
}

export default function GroupAdminOrdersPage() {
  const [commissions, setCommissions] = useState<Commission[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/commissions')
      .then(r => r.json())
      .then(d => setCommissions(d.commissions ?? []))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-gray-500">載入中…</p></div>

  return (
    <div className="px-4 py-5">
      <h1 className="text-xl font-bold mb-4">訂單中心</h1>
      <p className="text-sm text-gray-500 mb-4">顯示來自您社群券的訂單分潤紀錄。</p>
      <div className="space-y-2">
        {commissions.length === 0 && <p className="text-center text-gray-400 py-8">尚無訂單紀錄</p>}
        {commissions.map(c => (
          <div key={c.id} className="bg-white rounded-xl border p-4 shadow-sm">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-medium text-sm">{c.order.orderItems[0]?.productName ?? '—'}</p>
                <p className="text-xs text-gray-400">
                  {c.order.paidAt ? new Date(c.order.paidAt).toLocaleDateString('zh-TW') : '—'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">實付 NT${c.paidAmount}</p>
                <p className="font-bold text-blue-600">分潤 +NT${c.commissionAmount}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
