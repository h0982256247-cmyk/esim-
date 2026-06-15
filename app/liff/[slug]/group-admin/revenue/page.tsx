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

type WithdrawalRecord = { id: string; amount: number; status: string; appliedAt: string; processedAt: string | null; note: string | null }
type WithdrawalBalance = { settled: number; locked: number; paid: number; pending: number; available: number; pendingAdjustment: number }

const STATUS_LABEL: Record<string, { text: string; color: string }> = {
  PENDING: { text: '待結算', color: 'text-yellow-600' },
  SETTLED: { text: '已結算', color: 'text-green-600' },
  CANCELLED: { text: '已取消', color: 'text-gray-400' },
  PAID: { text: '已撥款', color: 'text-green-700' },
  REJECTED: { text: '已拒絕', color: 'text-red-600' },
}

// 提領狀態（與分潤/結算狀態不同，多一個 APPROVED）
const WD_STATUS: Record<string, { text: string; color: string }> = {
  PENDING:  { text: '審核中', color: 'text-yellow-600' },
  APPROVED: { text: '已核准·待撥款', color: 'text-blue-600' },
  PAID:     { text: '已撥款', color: 'text-green-700' },
  REJECTED: { text: '已拒絕', color: 'text-red-600' },
}

export default function RevenuePage() {
  const [commissions, setCommissions] = useState<Commission[]>([])
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [pendingBalance, setPendingBalance] = useState(0)
  const [withdrawals, setWithdrawals] = useState<WithdrawalRecord[]>([])
  const [balance, setBalance] = useState<WithdrawalBalance | null>(null)
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [requesting, setRequesting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'commissions' | 'settlements' | 'withdraw'>('commissions')

  const loadCommissions = () => fetch('/api/commissions').then(r => r.json()).then(d => {
    setCommissions(d.commissions ?? [])
    setSettlements(d.settlements ?? [])
    setPendingBalance(d.pendingBalance ?? 0)
  })
  const loadWithdrawals = () => fetch('/api/withdrawals').then(r => r.json()).then(d => {
    if (!d.error) { setWithdrawals(d.withdrawals ?? []); setBalance(d.balance ?? null) }
  })

  useEffect(() => {
    Promise.all([loadCommissions(), loadWithdrawals()]).finally(() => setLoading(false))
  }, [])

  const handleRequestWithdrawal = async () => {
    const amount = parseInt(withdrawAmount, 10)
    if (!Number.isInteger(amount) || amount <= 0) { window.alert('請輸入正整數金額'); return }
    setRequesting(true)
    const r = await fetch('/api/withdrawals', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount }),
    }).then(x => x.json())
    setRequesting(false)
    if (r.error) { window.alert(r.error); return }
    setWithdrawAmount('')
    loadWithdrawals()
  }

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-gray-500">載入中…</p></div>

  return (
    <div className="px-4 py-5">
      <h1 className="text-xl font-bold mb-2">收益中心</h1>
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
        <p className="text-sm text-blue-600">本月累積（待結算）</p>
        <p className="text-3xl font-extrabold text-blue-700">NT${pendingBalance.toLocaleString()}</p>
        <p className="text-xs text-blue-500 mt-1">每月 1 號結算；結算後可於「提領」申請撥款</p>
      </div>

      <div className="flex border-b mb-4">
        {(['commissions', 'settlements', 'withdraw'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 pb-2 text-sm font-medium border-b-2 transition ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400'}`}
          >
            {t === 'commissions' ? '分潤明細' : t === 'settlements' ? '每月結算' : '提領'}
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
          {settlements.length === 0 && <p className="text-center text-gray-400 py-8">尚無每月結算紀錄</p>}
          {settlements.map(s => {
            const status = STATUS_LABEL[s.status] ?? { text: s.status, color: 'text-gray-500' }
            const label = s.period.replace('-', '/')
            const paidDate = s.paidAt ? new Date(s.paidAt).toLocaleDateString('zh-TW') : null
            return (
              <div key={s.id} className="bg-white rounded-xl border p-4 shadow-sm flex justify-between items-center">
                <div>
                  <p className="font-medium">{label} 月結</p>
                  <span className={`text-xs ${status.color}`}>{status.text}{s.status === 'PAID' && paidDate ? ` · ${paidDate} 入帳` : ''}</span>
                </div>
                <p className={`font-bold ${s.totalAmount < 0 ? 'text-red-600' : 'text-blue-600'}`}>
                  NT${s.totalAmount.toLocaleString()}
                </p>
              </div>
            )
          })}
        </div>
      )}

      {tab === 'withdraw' && (
        <div className="space-y-3">
          {!balance ? (
            <p className="text-center text-gray-400 py-8">尚無可提領資料</p>
          ) : (
            <>
              <div className="bg-white rounded-xl border p-4 shadow-sm grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-gray-400">可提領</p>
                  <p className="text-2xl font-extrabold text-green-700">NT${balance.available.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">已撥款累計</p>
                  <p className="text-lg font-bold text-gray-600 mt-1">NT${balance.paid.toLocaleString()}</p>
                </div>
              </div>

              {balance.pendingAdjustment > 0 && (
                <div className="bg-amber-50 border border-amber-300 rounded-xl p-3">
                  <p className="text-xs font-semibold text-amber-800">⚠ 退款扣抵 NT${balance.pendingAdjustment.toLocaleString()}</p>
                  <p className="text-xs text-amber-700 mt-1">退款造成的待扣抵金額，會從之後新增的分潤自動扣回。</p>
                </div>
              )}

              <div className="bg-white rounded-xl border p-4 shadow-sm">
                {balance.available > 0 ? (
                  <div className="flex gap-2">
                    <input type="number" min={1} max={balance.available} value={withdrawAmount}
                      onChange={e => setWithdrawAmount(e.target.value)}
                      placeholder={`最多 NT$${balance.available}`}
                      className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <button onClick={handleRequestWithdrawal} disabled={requesting || !withdrawAmount}
                      className="shrink-0 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                      {requesting ? '送出中…' : '申請提領'}
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">
                    {balance.settled === 0 ? '尚無已結算分潤可提領'
                      : balance.pending > 0 ? `已申請待審 NT$${balance.pending.toLocaleString()}，請等待處理`
                      : '本期無可提領餘額'}
                  </p>
                )}
              </div>

              {withdrawals.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-400 font-medium px-1">提領記錄</p>
                  {withdrawals.map(w => {
                    const m = WD_STATUS[w.status] ?? { text: w.status, color: 'text-gray-500' }
                    return (
                      <div key={w.id} className="bg-white rounded-xl border p-3 shadow-sm flex justify-between items-center">
                        <div>
                          <p className="font-semibold text-sm">NT${w.amount.toLocaleString()}</p>
                          <p className="text-xs text-gray-400">{new Date(w.appliedAt).toLocaleDateString('zh-TW')}{w.note ? ` · ${w.note}` : ''}</p>
                        </div>
                        <span className={`text-xs font-medium ${m.color}`}>{m.text}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
