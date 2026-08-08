'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import TenantScopeBar from '@/components/platform/TenantScopeBar'

type Commission = {
  id: string; paidAmount: number; commissionAmount: number; status: string
  createdAt: string; group: { name: string }; order: { paidAt: string | null }
}
type GroupOption = { id: string; name: string; status: string }
// 結算應付總覽：撥款狀態真相在 Withdrawal（見 getAllSettlementsForAdmin）
type PayoutStatus = 'NONE' | 'PENDING' | 'APPROVED' | 'PAID'
type Settlement = {
  id: string; groupName: string; period: string; totalAmount: number
  paidAmount: number; createdAt: string; payoutStatus: PayoutStatus
}
const PAYOUT_META: Record<PayoutStatus, { label: string; cls: string }> = {
  NONE:     { label: '未提領',        cls: 'bg-gray-100 text-gray-500'  },
  PENDING:  { label: '審核中',        cls: 'bg-amber-50 text-amber-600' },
  APPROVED: { label: '已核准·待撥款', cls: 'bg-blue-50 text-blue-600'   },
  PAID:     { label: '已撥款',        cls: 'bg-green-50 text-green-700' },
}

// Default to previous month (YYYY-MM)
function defaultPeriod(): string {
  const d = new Date()
  d.setDate(1); d.setMonth(d.getMonth() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function PlatformCommissionsPage() {
  const router = useRouter()
  const [commissions, setCommissions] = useState<Commission[]>([])
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [loading, setLoading] = useState(true)
  const [groups, setGroups] = useState<GroupOption[]>([])
  const [settleForm, setSettleForm] = useState({groupId:'',period:defaultPeriod()})
  const [settling, setSettling] = useState(false)
  const [settleMsg, setSettleMsg] = useState<{ok:boolean;text:string}|null>(null)
  const [batchPeriod, setBatchPeriod] = useState(defaultPeriod())
  const [batching, setBatching] = useState(false)
  const [currentRole, setCurrentRole] = useState<string|null>(null)
  const [platformAdmins, setPlatformAdmins] = useState<{id:string;name:string;brandName:string|null}[]>([])
  const [filterTenantId, setFilterTenantId] = useState<string>('')

  useEffect(() => {
    fetch('/api/platform/auth/me').then(r=>r.json()).then(d=>{
      if(d.admin){setCurrentRole(d.admin.role);if(d.admin.role==='SUPER_ADMIN'){fetch('/api/platform/admins').then(r=>r.json()).then(a=>{setPlatformAdmins((a.admins??[]).filter((x:{role:string})=>x.role==='PLATFORM_ADMIN'))})}}
    })
  }, [])
  useEffect(() => {
    fetch(`/api/admin/commissions${filterTenantId?`?tenantAdminId=${filterTenantId}`:''}`)
      .then(r=>r.status===401?(router.replace('/platform/login'),null):r.json())
      .then(d=>{if(d){setCommissions(d.commissions);setSettlements(d.settlements??[])}}).finally(()=>setLoading(false))
    // 載入該 tenant 內的 APPROVED 社群供下拉選單
    fetch(`/api/admin/groups?status=APPROVED${filterTenantId?`&tenantAdminId=${filterTenantId}`:''}`)
      .then(r=>r.json())
      .then(d=>{if(d?.groups) setGroups(d.groups)})
  }, [filterTenantId,router])

  const handleSettle = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!settleForm.groupId) { setSettleMsg({ok:false,text:'請選擇社群'}); return }
    setSettling(true); setSettleMsg(null)
    const r = await fetch('/api/admin/commissions/settle',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(settleForm)}).then(x=>x.json())
    setSettling(false)
    if (r.ok) {
      setSettleMsg({ok:true,text:'月結執行完成'})
      fetch(`/api/admin/commissions${filterTenantId?`?tenantAdminId=${filterTenantId}`:''}`).then(r=>r.json()).then(d=>{if(d){setCommissions(d.commissions);setSettlements(d.settlements??[])}})
    } else {
      setSettleMsg({ok:false,text:r.error??'執行失敗'})
    }
  }

  const handleSettleAll = async () => {
    if (!batchPeriod) return
    if (!window.confirm(`對所有 ${groups.length} 個 APPROVED 社群執行 ${batchPeriod} 月結？\n沒有 PENDING 分潤的社群會自動跳過。`)) return
    setBatching(true); setSettleMsg(null)
    const r = await fetch('/api/admin/commissions/settle-all',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({period:batchPeriod}),
    }).then(x=>x.json())
    setBatching(false)
    if (r.error) {
      setSettleMsg({ok:false,text:r.error})
      return
    }
    const errLines = (r.errors as {groupName:string;error:string}[]).map(e=>`${e.groupName}: ${e.error}`).join('\n')
    setSettleMsg({
      ok: r.errors.length === 0,
      text: `已結算 ${r.settled} / ${r.totalGroups} 個社群${r.errors.length>0?`，失敗 ${r.errors.length} 個：\n${errLines}`:''}`,
    })
    fetch(`/api/admin/commissions${filterTenantId?`?tenantAdminId=${filterTenantId}`:''}`).then(r=>r.json()).then(d=>{if(d){setCommissions(d.commissions);setSettlements(d.settlements??[])}})
  }
  const totalPending = commissions.reduce((s,c)=>s+c.commissionAmount,0)
  // 尚未撥款＝各結算單「應付 − 已撥款」的正差額總和（涵蓋已撥款後又補結算、金額變大的差額）
  const unpaidTotal = settlements.reduce((sum,s)=>sum+Math.max(0,s.totalAmount-s.paidAmount),0)
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">分潤管理</h1>
        <p className="text-sm text-gray-400 mt-0.5">待結算分潤明細</p>
      </div>

      {currentRole==='SUPER_ADMIN'&&platformAdmins.length>0&&(
        <TenantScopeBar admins={platformAdmins} value={filterTenantId} onChange={v=>setFilterTenantId(v)} />
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"/></svg>
          </div>
          <div><p className="text-xs text-gray-400">待結算總金額</p><p className="text-2xl font-bold text-blue-600">NT${totalPending.toLocaleString()}</p></div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
          </div>
          <div><p className="text-xs text-gray-400">待結算筆數</p><p className="text-2xl font-bold text-gray-800">{commissions.length} 筆</p></div>
        </div>
      </div>

      {/* Settle form */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-5">
        <div>
          <h2 className="font-semibold text-gray-800 mb-1 flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            執行月結
          </h2>
          <p className="text-xs text-gray-400">結算後該期間的 PENDING 分潤會變為 SETTLED，社群主就能申請提領</p>
        </div>

        {/* 批次月結 */}
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
          <p className="text-sm font-semibold text-blue-900 mb-2">批次月結（推薦）</p>
          <p className="text-xs text-blue-700 mb-3">對所有 APPROVED 社群執行月結；無 PENDING 分潤的社群會自動跳過</p>
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="text-xs text-gray-600 block mb-1">結算期間</label>
              <input type="month" value={batchPeriod} onChange={e=>setBatchPeriod(e.target.value)} required
                className="border border-blue-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 bg-white" />
            </div>
            <button onClick={handleSettleAll} disabled={batching || groups.length===0}
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl text-sm font-medium disabled:opacity-50 transition">
              {batching?'執行中…':`結算所有社群（${groups.length} 個）`}
            </button>
          </div>
        </div>

        {/* 單一社群月結 */}
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-2">單一社群月結</p>
          <form onSubmit={handleSettle} className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="text-xs text-gray-500 block mb-1">社群</label>
              <select value={settleForm.groupId} onChange={e=>setSettleForm(p=>({...p,groupId:e.target.value}))} required
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm w-60 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 bg-white">
                <option value="">請選擇社群</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">結算期間</label>
              <input type="month" value={settleForm.period} onChange={e=>setSettleForm(p=>({...p,period:e.target.value}))} required
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 bg-white" />
            </div>
            <button type="submit" disabled={settling} className="bg-gray-700 hover:bg-gray-800 text-white px-5 py-2 rounded-xl text-sm font-medium disabled:opacity-50 transition">
              {settling?'執行中…':'執行月結'}
            </button>
          </form>
        </div>

        {settleMsg && (
          <div className={`text-sm whitespace-pre-line p-3 rounded-lg ${settleMsg.ok?'text-green-700 bg-green-50':'text-red-600 bg-red-50'}`}>
            {settleMsg.ok?'✅':'❌'} {settleMsg.text}
          </div>
        )}
      </div>

      {/* 各社群應付明細（已結算）— 唯讀總覽；撥款仍走「提領審核」頁 */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold text-gray-800">各社群應付明細（已結算）</h2>
            <p className="text-xs text-gray-400 mt-0.5">每月結算後應撥款給各社群主的金額。實際撥款與「已撥款」標記請至「提領審核」頁（社群主申請提領後操作）。</p>
          </div>
          {!loading && (
            <div className="text-right flex-shrink-0">
              <p className="text-xs text-gray-400">尚未撥款</p>
              <p className="text-xl font-bold text-blue-600">NT${unpaidTotal.toLocaleString()}</p>
            </div>
          )}
        </div>
        {loading ? (
          <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
        ) : (
        <div className="rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['社群','結算月份','應付金額','撥款狀態'].map(h=>(
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {settlements.map(s=>{
                const unpaid = Math.max(0, s.totalAmount - s.paidAmount)
                // 已撥款後又補結算 → 狀態雖 PAID 但仍有差額，標「部分撥款」避免誤判全數付清
                const partial = s.payoutStatus==='PAID' && unpaid>0
                const meta = partial ? { label: '部分撥款', cls: 'bg-amber-50 text-amber-600' } : PAYOUT_META[s.payoutStatus]
                return (
                  <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-gray-800">{s.groupName}</td>
                    <td className="px-5 py-3.5 text-gray-600">{s.period.replace('-','/')}</td>
                    <td className="px-5 py-3.5">
                      <span className="font-semibold text-blue-600">NT${s.totalAmount.toLocaleString()}</span>
                      {partial && <span className="text-xs text-amber-600 ml-1.5">（待撥 NT${unpaid.toLocaleString()}）</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${meta.cls}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70"/>{meta.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {settlements.length===0 && <div className="text-center py-10"><p className="text-gray-400 text-sm">尚無結算記錄；執行月結後這裡會列出各社群本月應付金額</p></div>}
        </div>
        )}
      </div>

      {/* 待結算明細（尚未月結的單筆分潤）*/}
      {loading ? <div className="flex justify-center py-16"><div className="w-7 h-7 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div> : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 pt-4 pb-1">
            <h2 className="font-semibold text-gray-800">待結算明細</h2>
            <p className="text-xs text-gray-400">尚未月結的單筆分潤（月結後會移入上方「已結算」總覽）</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['社群','實付金額','分潤金額','付款時間','狀態'].map(h=>(
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {commissions.map(c=>(
                <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-gray-800">{c.group.name}</td>
                  <td className="px-5 py-3.5 text-gray-600">NT${c.paidAmount.toLocaleString()}</td>
                  <td className="px-5 py-3.5 font-semibold text-blue-600">NT${c.commissionAmount.toLocaleString()}</td>
                  <td className="px-5 py-3.5 text-xs text-gray-400">{c.order.paidAt?new Date(c.order.paidAt).toLocaleDateString('zh-TW'):'—'}</td>
                  <td className="px-5 py-3.5">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-yellow-50 text-yellow-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70"/>待結算
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {commissions.length===0&&<div className="text-center py-12"><p className="text-gray-400 text-sm">目前沒有待結算的分潤</p></div>}
        </div>
      )}
    </div>
  )
}
