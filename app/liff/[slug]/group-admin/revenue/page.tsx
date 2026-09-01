'use client'

import { useEffect, useState } from 'react'
import { useTenantColors } from '@/components/liff/TenantContext'
import PageSkeleton from '@/components/liff/PageSkeleton'

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
    subtotal: number
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

type WithdrawalRecord = { id: string; amount: number; period: string | null; status: string; appliedAt: string; processedAt: string | null; note: string | null }
type WithdrawalBalance = { settled: number; locked: number; paid: number; pending: number; available: number; pendingAdjustment: number }
type WithdrawableMonth = { period: string; amount: number }

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
  const C = useTenantColors()
  const [commissions, setCommissions] = useState<Commission[]>([])
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [pendingBalance, setPendingBalance] = useState(0)
  const [withdrawals, setWithdrawals] = useState<WithdrawalRecord[]>([])
  const [balance, setBalance] = useState<WithdrawalBalance | null>(null)
  const [withdrawableMonths, setWithdrawableMonths] = useState<WithdrawableMonth[]>([])
  const [requesting, setRequesting] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'commissions' | 'settlements' | 'withdraw'>('commissions')
  const [monthFilter, setMonthFilter] = useState<string>('all')
  // 提領銀行帳戶（收益中心內直接設定）：帳號回傳為遮罩(••••末4)；bankAccountSet 表示已設定
  const [bank, setBank] = useState<{ bankName: string; bankBranch: string; bankAccount: string; bankHolderName: string; bankAccountSet: boolean } | null>(null)
  const [showBankModal, setShowBankModal] = useState(false)
  const [bankForm, setBankForm] = useState({ bankName: '', bankBranch: '', bankAccount: '', bankHolderName: '' })
  const [savingBank, setSavingBank] = useState(false)
  const [bankMsg, setBankMsg] = useState<string | null>(null)

  const loadCommissions = () => fetch('/api/commissions').then(r => r.json()).then(d => {
    setCommissions(d.commissions ?? [])
    setSettlements(d.settlements ?? [])
    setPendingBalance(d.pendingBalance ?? 0)
  })
  const loadWithdrawals = () => fetch('/api/withdrawals').then(r => r.json()).then(d => {
    if (!d.error) {
      setWithdrawals(d.withdrawals ?? [])
      setBalance(d.balance ?? null)
      setWithdrawableMonths(d.withdrawableMonths ?? [])
    }
  })

  const loadGroup = () => fetch('/api/groups').then(r => r.json()).then(d => {
    const g = d.ownedGroup
    if (g) setBank({
      bankName: g.bankName ?? '', bankBranch: g.bankBranch ?? '',
      bankAccount: g.bankAccount ?? '', bankHolderName: g.bankHolderName ?? '',
      bankAccountSet: !!g.bankAccountSet,
    })
  }).catch(() => {})

  useEffect(() => {
    Promise.all([loadCommissions(), loadWithdrawals(), loadGroup()]).finally(() => setLoading(false))
  }, [])

  // 只能整月提領：對某個結算月份送出申請（金額由後端鎖定為該月結算總額）。
  const handleWithdrawMonth = async (period: string) => {
    if (!window.confirm(`確定申請提領 ${period.replace('-', '/')} 整月分潤？送出後等平台撥款。`)) return
    setRequesting(period)
    const r = await fetch('/api/withdrawals', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ period }),
    }).then(x => x.json()).catch(() => ({ error: '連線失敗' }))
    setRequesting(null)
    if (r.error) { window.alert(r.error); return }
    loadWithdrawals()
  }

  const openBankModal = () => {
    setBankForm({
      bankName: bank?.bankName ?? '', bankBranch: bank?.bankBranch ?? '',
      bankAccount: bank?.bankAccount ?? '', bankHolderName: bank?.bankHolderName ?? '',
    })
    setBankMsg(null)
    setShowBankModal(true)
  }

  const saveBank = async () => {
    setSavingBank(true); setBankMsg(null)
    const r = await fetch('/api/groups/settings', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bankForm),
    }).then(x => x.json()).catch(() => ({ error: '連線失敗' }))
    setSavingBank(false)
    if (r.error) { setBankMsg(`❌ ${r.error}`); return }
    await loadGroup()
    setShowBankModal(false)
  }

  if (loading) return <div className="px-4 py-5"><PageSkeleton rows={4} /></div>

  // 收益月份篩選：選項取自分潤(付款月)與結算月份，去重後新到舊。
  const monthOf = (iso: string | null) => (iso ? iso.slice(0, 7) : '')
  const monthOptions = Array.from(new Set([
    ...commissions.map(c => monthOf(c.order.paidAt)).filter(Boolean),
    ...settlements.map(s => s.period),
  ])).sort().reverse()
  const filteredCommissions = monthFilter === 'all' ? commissions : commissions.filter(c => monthOf(c.order.paidAt) === monthFilter)
  const filteredSettlements = monthFilter === 'all' ? settlements : settlements.filter(s => s.period === monthFilter)

  return (
    <div className="px-4 py-5">
      <h1 className="text-xl font-bold mb-2">收益中心</h1>
      <div className="rounded-xl p-4 mb-4" style={{ background: C.light, border: `1px solid ${C.border}` }}>
        <p className="text-sm" style={{ color: C.primaryText }}>本月累積（待結算）</p>
        <p className="text-3xl font-extrabold" style={{ color: C.primaryText }}>NT${pendingBalance.toLocaleString()}</p>
        <p className="text-xs mt-1" style={{ color: C.primaryText, opacity: 0.8 }}>每月 1 號結算；結算後可於「提領」申請撥款</p>
      </div>

      <div className="flex border-b mb-4">
        {(['commissions', 'settlements', 'withdraw'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="flex-1 pb-2 text-sm font-medium border-b-2 transition"
            style={tab === t ? { borderColor: C.primary, color: C.primaryText } : { borderColor: 'transparent', color: '#9ca3af' }}
          >
            {t === 'commissions' ? '分潤明細' : t === 'settlements' ? '每月結算' : '提領'}
          </button>
        ))}
      </div>

      {tab !== 'withdraw' && monthOptions.length > 0 && (
        <div className="mb-3">
          <select
            value={monthFilter}
            onChange={e => setMonthFilter(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-200"
          >
            <option value="all">全部月份</option>
            {monthOptions.map(m => <option key={m} value={m}>{m.replace('-', '/')}</option>)}
          </select>
        </div>
      )}

      {tab === 'commissions' && (
        <div className="space-y-2">
          {filteredCommissions.length === 0 && <p className="text-center text-gray-400 py-8">尚無分潤紀錄</p>}
          {filteredCommissions.map(c => {
            const s = STATUS_LABEL[c.status] ?? { text: c.status, color: 'text-gray-500' }
            return (
              <div key={c.id} className="bg-white rounded-xl border p-4 shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-sm">{c.order.orderItems[0]?.productName ?? '—'}</p>
                    <p className="text-xs text-gray-400">{c.order.paidAt ? new Date(c.order.paidAt).toLocaleDateString('zh-TW') : '—'}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold" style={{ color: C.primaryText }}>+NT${c.commissionAmount}</p>
                    <span className={`text-xs ${s.color}`}>{s.text}</span>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  原價 NT${c.order.subtotal.toLocaleString()} × {Math.round(Number(c.ownerRate) * 100)}% 分潤
                </p>
              </div>
            )
          })}
        </div>
      )}

      {tab === 'settlements' && (
        <div className="space-y-2">
          {filteredSettlements.length === 0 && <p className="text-center text-gray-400 py-8">尚無每月結算紀錄</p>}
          {filteredSettlements.map(s => {
            const status = STATUS_LABEL[s.status] ?? { text: s.status, color: 'text-gray-500' }
            const label = s.period.replace('-', '/')
            const paidDate = s.paidAt ? new Date(s.paidAt).toLocaleDateString('zh-TW') : null
            return (
              <div key={s.id} className="bg-white rounded-xl border p-4 shadow-sm flex justify-between items-center">
                <div>
                  <p className="font-medium">{label} 月結</p>
                  <span className={`text-xs ${status.color}`}>{status.text}{s.status === 'PAID' && paidDate ? ` · ${paidDate} 入帳` : ''}</span>
                </div>
                <p className="font-bold" style={{ color: s.totalAmount < 0 ? '#dc2626' : C.primary }}>
                  NT${s.totalAmount.toLocaleString()}
                </p>
              </div>
            )
          })}
        </div>
      )}

      {tab === 'withdraw' && (
        <div className="space-y-3">
          {/* 提領銀行帳戶：未設定 → 提示；已設定 → 顯示遮罩；皆可點「設定/修改」在此補齊 */}
          <div className="bg-white rounded-xl border p-4 shadow-sm flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-gray-400">提領銀行帳戶</p>
              {bank?.bankAccountSet ? (
                <p className="text-sm font-medium text-gray-800 truncate">{bank.bankName || '—'}　{bank.bankAccount}</p>
              ) : (
                <p className="text-sm font-medium text-amber-600">尚未設定，提領前請先補齊</p>
              )}
            </div>
            <button
              onClick={openBankModal}
              className="shrink-0 text-xs font-semibold px-3 py-2 rounded-lg"
              style={{ background: C.light, color: C.primaryText, border: `1px solid ${C.border}` }}
            >
              {bank?.bankAccountSet ? '修改' : '設定'}
            </button>
          </div>

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
                <p className="text-xs text-gray-400 mb-2 font-medium">可提領月份（每次提領整月，不可拆分）</p>
                {withdrawableMonths.length === 0 ? (
                  <p className="text-sm text-gray-400">
                    {balance.settled === 0 ? '尚無已結算分潤可提領' : '目前沒有可提領的月份（已結算月份皆已申請或撥款）'}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {withdrawableMonths.map(m => (
                      <div key={m.period} className="flex items-center justify-between border rounded-lg px-3 py-2">
                        <div>
                          <p className="font-semibold text-sm">{m.period.replace('-', '/')} 月結</p>
                          <p className="text-xs" style={{ color: C.primaryText }}>NT${m.amount.toLocaleString()}</p>
                        </div>
                        <button
                          onClick={() => handleWithdrawMonth(m.period)}
                          disabled={requesting === m.period}
                          className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
                          style={{ background: C.primary, color: C.onPrimary }}
                        >
                          {requesting === m.period ? '送出中…' : '提領整月'}
                        </button>
                      </div>
                    ))}
                  </div>
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
                          <p className="font-semibold text-sm">{w.period ? `${w.period.replace('-', '/')} · ` : ''}NT${w.amount.toLocaleString()}</p>
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

      {/* 銀行帳戶設定 modal（存 /api/groups/settings，與設定頁同一支 API；帳號遮罩不覆寫）*/}
      {showBankModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowBankModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="font-bold text-lg mb-1">提領銀行帳戶</h2>
            <p className="text-xs text-gray-400 mb-4">填寫後即可申請提領撥款。</p>
            {([
              { key: 'bankName', label: '銀行名稱', ph: '例：國泰世華' },
              { key: 'bankBranch', label: '分行', ph: '例：信義分行' },
              { key: 'bankAccount', label: '帳號', ph: '請輸入完整帳號' },
              { key: 'bankHolderName', label: '戶名', ph: '存摺上的戶名' },
            ] as const).map(f => (
              <div key={f.key} className="mb-3">
                <label className="text-sm text-gray-600 block mb-1">{f.label}</label>
                <input
                  value={bankForm[f.key]}
                  onChange={e => setBankForm(p => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.ph}
                  style={{ fontSize: 16 }}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            ))}
            <p className="text-xs text-gray-400 leading-relaxed mb-3">🔒 帳號為機密資料，這裡只顯示末 4 碼；完整帳號僅平台方在撥款時可見。要更改請直接輸入新的完整帳號。</p>
            {bankMsg && <p className="text-sm text-center mb-2 text-red-500">{bankMsg}</p>}
            <div className="flex gap-2">
              <button onClick={() => setShowBankModal(false)} className="flex-1 py-2.5 rounded-xl font-semibold border text-gray-600">取消</button>
              <button onClick={saveBank} disabled={savingBank} className="flex-1 py-2.5 rounded-xl font-semibold disabled:opacity-50" style={{ background: C.primary, color: C.onPrimary }}>
                {savingBank ? '儲存中…' : '儲存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
