'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type Commission = {
  id: string
  paidAmount: number
  commissionAmount: number
  status: string
  createdAt: string
  group: { name: string }
  order: { paidAt: string | null }
}

export default function PlatformCommissionsPage() {
  const router = useRouter()
  const [commissions, setCommissions] = useState<Commission[]>([])
  const [loading, setLoading] = useState(true)
  const [settleForm, setSettleForm] = useState({ groupId: '', period: '' })
  const [settling, setSettling] = useState(false)
  const [settleMsg, setSettleMsg] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/commissions')
      .then(r => r.status === 401 ? (router.replace('/platform/login'), null) : r.json())
      .then(d => { if (d) setCommissions(d.commissions) })
      .finally(() => setLoading(false))
  }, [router])

  const handleSettle = async (e: React.FormEvent) => {
    e.preventDefault()
    setSettling(true)
    setSettleMsg(null)
    const r = await fetch('/api/admin/commissions/settle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settleForm),
    }).then(x => x.json())
    setSettling(false)
    setSettleMsg(r.ok ? '✅ 月結完成' : `❌ ${r.error}`)
  }

  const totalPending = commissions.reduce((sum, c) => sum + c.commissionAmount, 0)

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">分潤管理</h1>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-2xl border p-5 shadow-sm">
          <p className="text-xs text-gray-400 mb-1">待結算總金額</p>
          <p className="text-2xl font-bold text-blue-600">NT${totalPending.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-2xl border p-5 shadow-sm">
          <p className="text-xs text-gray-400 mb-1">待結算筆數</p>
          <p className="text-2xl font-bold text-gray-800">{commissions.length} 筆</p>
        </div>
      </div>

      {/* 月結操作 */}
      <div className="bg-white rounded-2xl border p-5 shadow-sm mb-6">
        <h2 className="font-semibold mb-3">執行月結</h2>
        <form onSubmit={handleSettle} className="flex gap-3 items-end">
          <div>
            <label className="text-xs text-gray-500 block mb-1">社群 ID</label>
            <input
              value={settleForm.groupId}
              onChange={e => setSettleForm(p => ({ ...p, groupId: e.target.value }))}
              placeholder="Group ID"
              required
              className="border rounded-lg px-3 py-2 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">期間</label>
            <input
              type="month"
              value={settleForm.period}
              onChange={e => setSettleForm(p => ({ ...p, period: e.target.value }))}
              required
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button type="submit" disabled={settling} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50">
            {settling ? '執行中…' : '執行月結'}
          </button>
          {settleMsg && <span className="text-sm">{settleMsg}</span>}
        </form>
      </div>

      {/* 分潤明細表格 */}
      {loading ? <p className="text-gray-400 text-sm">載入中…</p> : (
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['社群', '實付金額', '分潤金額', '付款時間', '狀態'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {commissions.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-sm">{c.group.name}</td>
                  <td className="px-4 py-3 text-sm">NT${c.paidAmount}</td>
                  <td className="px-4 py-3 font-semibold text-blue-600">NT${c.commissionAmount}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {c.order.paidAt ? new Date(c.order.paidAt).toLocaleDateString('zh-TW') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-600">待結算</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {commissions.length === 0 && <p className="text-center text-gray-400 py-8 text-sm">無待結算分潤</p>}
        </div>
      )}
    </div>
  )
}
