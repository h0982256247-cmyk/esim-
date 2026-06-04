'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

type Order = {
  id: string
  status: string
  totalPaid: number
  paymentMethod: string
  paidAt: string | null
  createdAt: string
  retryCount: number
  user: { displayName: string }
  orderItems: { productName: string }[]
}

const STATUS_OPTS = ['', 'PENDING', 'PAID', 'COMPLETED', 'FAILED', 'ESIM_PENDING', 'REFUNDED']
const STATUS_LABEL: Record<string, { text: string; color: string }> = {
  PENDING: { text: '待付款', color: 'text-yellow-600 bg-yellow-50' },
  PROCESSING: { text: '付款中', color: 'text-blue-600 bg-blue-50' },
  PAID: { text: '付款成功', color: 'text-green-600 bg-green-50' },
  COMPLETED: { text: '已完成', color: 'text-green-700 bg-green-100' },
  FAILED: { text: '付款失敗', color: 'text-red-600 bg-red-50' },
  ESIM_PENDING: { text: 'eSIM待補', color: 'text-orange-600 bg-orange-50' },
  REFUNDED: { text: '已退款', color: 'text-gray-500 bg-gray-100' },
}

export default function PlatformOrdersPage() {
  return <Suspense fallback={<div className="text-gray-400">載入中…</div>}><OrdersContent /></Suspense>
}

function OrdersContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const statusFilter = searchParams.get('status') ?? ''
  const page = parseInt(searchParams.get('page') ?? '1')

  const [orders, setOrders] = useState<Order[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const [currentRole, setCurrentRole] = useState<string | null>(null)
  const [platformAdmins, setPlatformAdmins] = useState<{ id: string; name: string; brandName: string | null }[]>([])
  const [filterTenantId, setFilterTenantId] = useState<string>('')

  useEffect(() => {
    fetch('/api/platform/auth/me').then(r => r.json()).then(d => {
      if (d.admin) {
        setCurrentRole(d.admin.role)
        if (d.admin.role === 'SUPER_ADMIN') {
          fetch('/api/platform/admins').then(r => r.json()).then(a => {
            setPlatformAdmins((a.admins ?? []).filter((x: { role: string }) => x.role === 'PLATFORM_ADMIN'))
          })
        }
      }
    })
  }, [])

  const load = () => {
    setLoading(true)
    fetch(`/api/platform/orders?page=${page}${statusFilter ? `&status=${statusFilter}` : ''}${filterTenantId ? `&tenantAdminId=${filterTenantId}` : ''}`)
      .then(r => r.status === 401 ? (router.replace('/platform/login'), null) : r.json())
      .then(d => { if (d) { setOrders(d.orders); setTotal(d.total) } })
      .finally(() => setLoading(false))
  }

  useEffect(load, [page, statusFilter, filterTenantId, router])

  const handleRetry = async (id: string) => {
    setActionLoading(id)
    await fetch(`/api/platform/orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'retry_esim' }),
    })
    setActionLoading(null)
    load()
  }

  const handleRefund = async (id: string) => {
    if (!confirm('確定要退款此筆訂單？')) return
    setActionLoading(id)
    await fetch(`/api/platform/orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'refund' }),
    })
    setActionLoading(null)
    load()
  }

  const totalPages = Math.ceil(total / 20)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">訂單管理</h1>
        <span className="text-sm text-gray-400">共 {total} 筆</span>
      </div>

      {/* 篩選列 */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        {STATUS_OPTS.map(s => (
          <button
            key={s}
            onClick={() => router.push(s ? `/platform/orders?status=${s}&page=1` : '/platform/orders?page=1')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${statusFilter === s ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
          >
            {s ? (STATUS_LABEL[s]?.text ?? s) : '全部'}
          </button>
        ))}
        {currentRole === 'SUPER_ADMIN' && platformAdmins.length > 0 && (
          <select
            value={filterTenantId}
            onChange={e => { setFilterTenantId(e.target.value) }}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">全部平台</option>
            {platformAdmins.map(a => (
              <option key={a.id} value={a.id}>{a.brandName ?? a.name}</option>
            ))}
          </select>
        )}
      </div>

      {loading ? <p className="text-gray-400 text-sm">載入中…</p> : (
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['訂單', '會員', '金額', '狀態', '時間', '操作'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {orders.map(o => {
                const s = STATUS_LABEL[o.status] ?? { text: o.status, color: 'text-gray-500 bg-gray-100' }
                return (
                  <tr key={o.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-mono text-xs text-gray-400">#{o.id.slice(-8).toUpperCase()}</p>
                      <p className="text-xs mt-0.5">{o.orderItems[0]?.productName ?? '—'}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{o.user.displayName}</td>
                    <td className="px-4 py-3 font-semibold">NT${o.totalPaid}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.color}`}>{s.text}</span>
                      {o.retryCount > 0 && <span className="block text-xs text-gray-400">retry: {o.retryCount}</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {new Date(o.createdAt).toLocaleDateString('zh-TW')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        {o.status === 'ESIM_PENDING' && (
                          <button
                            onClick={() => handleRetry(o.id)}
                            disabled={actionLoading === o.id}
                            className="text-xs bg-blue-600 text-white px-2 py-1 rounded disabled:opacity-50"
                          >
                            補發
                          </button>
                        )}
                        {(o.status === 'PAID' || o.status === 'COMPLETED') && (
                          <button
                            onClick={() => handleRefund(o.id)}
                            disabled={actionLoading === o.id}
                            className="text-xs bg-red-500 text-white px-2 py-1 rounded disabled:opacity-50"
                          >
                            退款
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {orders.length === 0 && <p className="text-center text-gray-400 py-8 text-sm">無資料</p>}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-5">
          {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => i + 1).map(p => (
            <button
              key={p}
              onClick={() => router.push(`/platform/orders?status=${statusFilter}&page=${p}`)}
              className={`w-8 h-8 rounded-lg text-sm ${p === page ? 'bg-blue-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
