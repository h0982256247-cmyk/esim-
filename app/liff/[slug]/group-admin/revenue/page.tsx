'use client'

import { useEffect, useState } from 'react'

type Commission = {
  id: string
  paidAmount: number
  rebateRate: number
  ownerRate: number
  commissionAmount: number
  status: string
  createdAt: string
  order: {
    id: string
    paidAt: string | null
    orderItems: { productName: string }[]
  }
}

type Settlement = {
  id: string
  period: string
  totalAmount: number
  status: string
  paidAt: string | null
}

const STATUS_LABEL: Record<string, { text: string; color: string }> = {
  PENDING: { text: '待結算', color: 'text-yellow-600' },
  SETTLED: { text: '已結算', color: 'text-green-600' },
  CANCELLED: { text: '已取消', color: 'text-gray-400' },
  PAID: { text: '已匯款', color: 'text-green-700' },
  REJECTED: { text: '已拒絕', color: 'text-red-600' },
}

export default function RevenuePage() {
  const [commissions, setCommissions] = useState<Commission[]>([])
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [pendingBalance, setPendingBalance] = useState(0)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'commissions' | 'settlements'>('commissions')

  useEffect(() => {
    fetch('/api/commissions')
      .then(r => r.json())
      .then(d => {
        setCommissions(d.commissions ?? [])
        setSettlements(d.settlements ?? [])
        setPendingBalance(d.pendingBalance ?? 0)
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-gray-500">載入中…</p></div>

  return (
    <div className="px-4 py-5">
      <h1 className="text-xl font-bold mb-2">收益中心</h1>
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
        <p className="text-sm text-blue-600">待結算金額</p>
        <p className="text-3xl font-extrabold text-blue-700">NT${pendingBalance.toLocaleString()}</p>
      </div>

      <div className="flex border-b mb-4">
        {(['commissions', 'settlements'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 pb-2 text-sm font-medium border-b-2 transition ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400'}`}
          >
            {t === 'commissions' ? '分潤明細' : '結算紀錄'}
          </button>
        ))}
      </div>

      {tab === 'commissions' && (
        <div className="space-y-2">
          {commissions.length === 0 && <p className="text-center text-gray-400 py-8">尚無分潤紀錄</p>}
          {commissions.map(c => {
            const s = STATUS_LABEL[c.status] ?? { text: c.status, color: 'text-gray-500' }
            return (
              <div key={c.id} className="bg-white rounded-xl border p-4 shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-sm">{c.order.orderItems[0]?.productName ?? '—'}</p>
                    <p className="text-xs text-gray-400">{c.order.paidAt ? new Date(c.order.paidAt).toLocaleDateString('zh-TW') : '—'}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-blue-600">+NT${c.commissionAmount}</p>
                    <span className={`text-xs ${s.color}`}>{s.text}</span>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  實付 NT${c.paidAmount} × {Math.round(Number(c.ownerRate) * 100)}%
                </p>
              </div>
            )
          })}
        </div>
      )}

      {tab === 'settlements' && (
        <div className="space-y-2">
          {settlements.length === 0 && <p className="text-center text-gray-400 py-8">尚無結算紀錄</p>}
          {settlements.map(s => {
            const status = STATUS_LABEL[s.status] ?? { text: s.status, color: 'text-gray-500' }
            return (
              <div key={s.id} className="bg-white rounded-xl border p-4 shadow-sm flex justify-between items-center">
                <div>
                  <p className="font-medium">{s.period} 結算</p>
                  <span className={`text-xs ${status.color}`}>{status.text}</span>
                </div>
                <p className={`font-bold ${s.totalAmount < 0 ? 'text-red-600' : 'text-blue-600'}`}>
                  NT${s.totalAmount.toLocaleString()}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
