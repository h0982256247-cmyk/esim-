'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type TenantStat = {
  id: string
  name: string
  brandName: string | null
  revenue: number
  orders: number
  groups: number
  users: number
  pendingCommissions: number
}

type FinanceData = {
  month: string | null
  global: { revenue: number; orders: number }
  tenants: TenantStat[]
}

export default function FinancePage() {
  const router = useRouter()
  const [data, setData] = useState<FinanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState<string>('')  // YYYY-MM or '' for all time

  useEffect(() => {
    setLoading(true)
    const url = `/api/platform/finance${month ? `?month=${month}` : ''}`
    fetch(url)
      .then(r => r.status === 401 ? (router.replace('/platform/login'), null) : r.status === 403 ? (router.replace('/platform'), null) : r.json())
      .then(d => { if (d) setData(d) })
      .finally(() => setLoading(false))
  }, [month, router])

  const sorted = data?.tenants.slice().sort((a, b) => b.revenue - a.revenue) ?? []
  const totalTenantRevenue = sorted.reduce((s, t) => s + Number(t.revenue), 0)

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">財務總覽</h1>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">月份篩選</label>
          <input
            type="month"
            value={month}
            onChange={e => setMonth(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {month && (
            <button onClick={() => setMonth('')} className="text-xs text-gray-400 hover:text-gray-600">
              清除
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">載入中…</p>
      ) : !data ? null : (
        <>
          {/* Global summary cards */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-2xl border shadow-sm p-5">
              <p className="text-xs text-gray-400 mb-1">{month ? `${month} 總營收` : '累計總營收'}</p>
              <p className="text-2xl font-bold text-blue-600">NT$ {Number(data.global.revenue).toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-2xl border shadow-sm p-5">
              <p className="text-xs text-gray-400 mb-1">{month ? `${month} 訂單數` : '累計訂單數'}</p>
              <p className="text-2xl font-bold text-gray-800">{data.global.orders.toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-2xl border shadow-sm p-5">
              <p className="text-xs text-gray-400 mb-1">Platform Admin 數</p>
              <p className="text-2xl font-bold text-gray-800">{data.tenants.length}</p>
            </div>
          </div>

          {/* Per-tenant table */}
          <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {['平台名稱', '訂單數', '營收', '佔比', '待結算分潤', '社群數', '會員數'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {sorted.map(t => {
                  const pct = totalTenantRevenue > 0 ? (Number(t.revenue) / totalTenantRevenue * 100) : 0
                  return (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">
                        {t.brandName ?? t.name}
                        {t.brandName && <span className="ml-1 text-xs text-gray-400">({t.name})</span>}
                      </td>
                      <td className="px-4 py-3 text-sm">{t.orders.toLocaleString()}</td>
                      <td className="px-4 py-3 font-semibold text-blue-600">NT$ {Number(t.revenue).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-100 rounded-full h-1.5 w-16">
                            <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
                          </div>
                          <span className="text-xs text-gray-500">{pct.toFixed(1)}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-orange-600">NT$ {Number(t.pendingCommissions).toLocaleString()}</td>
                      <td className="px-4 py-3 text-xs">{t.groups}</td>
                      <td className="px-4 py-3 text-xs">{t.users}</td>
                    </tr>
                  )
                })}
                {sorted.length === 0 && (
                  <tr><td colSpan={7} className="text-center text-gray-400 py-8 text-sm">暫無資料</td></tr>
                )}
              </tbody>
              {sorted.length > 0 && (
                <tfoot className="border-t bg-gray-50">
                  <tr>
                    <td className="px-4 py-3 text-xs font-semibold text-gray-600">合計</td>
                    <td className="px-4 py-3 text-xs font-semibold">{sorted.reduce((s, t) => s + t.orders, 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-blue-600">NT$ {totalTenantRevenue.toLocaleString()}</td>
                    <td className="px-4 py-3"></td>
                    <td className="px-4 py-3 text-xs font-semibold text-orange-600">
                      NT$ {sorted.reduce((s, t) => s + Number(t.pendingCommissions), 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold">{sorted.reduce((s, t) => s + t.groups, 0)}</td>
                    <td className="px-4 py-3 text-xs font-semibold">{sorted.reduce((s, t) => s + t.users, 0)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </>
      )}
    </div>
  )
}
