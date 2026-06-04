'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type Order = {
  id: string
  status: string
  totalPaid: number
  subtotal: number
  discountAmount: number
  paymentMethod: string
  paidAt: string | null
  createdAt: string
  orderItems: { productName: string; qty: number; unitPrice: number }[]
}

const STATUS_LABEL: Record<string, { text: string; color: string }> = {
  PENDING: { text: '待付款', color: 'text-yellow-600 bg-yellow-50' },
  PROCESSING: { text: '付款中', color: 'text-blue-600 bg-blue-50' },
  PAID: { text: '付款成功', color: 'text-green-600 bg-green-50' },
  COMPLETED: { text: '已完成', color: 'text-green-700 bg-green-100' },
  FAILED: { text: '付款失敗', color: 'text-red-600 bg-red-50' },
  ESIM_PENDING: { text: 'eSIM 處理中', color: 'text-orange-600 bg-orange-50' },
  REFUNDED: { text: '已退款', color: 'text-gray-600 bg-gray-100' },
}

export default function OrdersPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/orders')
      .then(r => r.json())
      .then(d => setOrders(d.orders ?? []))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex items-center justify-center min-h-screen"><p className="text-gray-500">載入中…</p></div>

  return (
    <div className="max-w-lg mx-auto pb-24">
      <div className="px-4 pt-6 pb-2">
        <h1 className="text-xl font-bold">我的訂單</h1>
      </div>
      <div className="px-4 py-3 space-y-3">
        {orders.length === 0 && (
          <p className="text-center text-gray-400 py-10">目前沒有訂單紀錄</p>
        )}
        {orders.map(o => {
          const s = STATUS_LABEL[o.status] ?? { text: o.status, color: 'text-gray-600 bg-gray-100' }
          return (
            <button
              key={o.id}
              onClick={() => router.push(`/orders/${o.id}`)}
              className="w-full text-left bg-white rounded-xl border p-4 shadow-sm active:bg-gray-50 transition"
            >
              <div className="flex items-start justify-between mb-2">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.color}`}>{s.text}</span>
                <span className="text-xs text-gray-400">{new Date(o.createdAt).toLocaleDateString('zh-TW')}</span>
              </div>
              <p className="font-medium text-gray-900">{o.orderItems[0]?.productName ?? '—'}</p>
              <div className="flex justify-between items-end mt-2">
                <p className="text-xs text-gray-400">訂單 #{o.id.slice(-8).toUpperCase()}</p>
                <p className="font-bold text-blue-600">NT${o.totalPaid}</p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
