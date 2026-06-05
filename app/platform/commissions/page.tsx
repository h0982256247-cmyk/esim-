'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import TenantScopeBar from '@/components/platform/TenantScopeBar'

type Commission = {
  id: string; paidAmount: number; commissionAmount: number; status: string
  createdAt: string; group: { name: string }; order: { paidAt: string | null }
}
export default function PlatformCommissionsPage() {
  const router = useRouter()
  const [commissions, setCommissions] = useState<Commission[]>([])
  const [loading, setLoading] = useState(true)
  const [settleForm, setSettleForm] = useState({groupId:'',period:''})
  const [settling, setSettling] = useState(false)
  const [settleMsg, setSettleMsg] = useState<{ok:boolean;text:string}|null>(null)
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
      .then(d=>{if(d)setCommissions(d.commissions)}).finally(()=>setLoading(false))
  }, [filterTenantId,router])

  const handleSettle = async (e: React.FormEvent) => {
    e.preventDefault(); setSettling(true); setSettleMsg(null)
    const r = await fetch('/api/admin/commissions/settle',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(settleForm)}).then(x=>x.json())
    setSettling(false); setSettleMsg(r.ok?{ok:true,text:'月結執行完成'}:{ok:false,text:r.error??'執行失敗'})
  }
  const totalPending = commissions.reduce((s,c)=>s+c.commissionAmount,0)
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
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          執行月結
        </h2>
        <form onSubmit={handleSettle} className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs text-gray-500 block mb-1">社群 ID</label>
            <input value={settleForm.groupId} onChange={e=>setSettleForm(p=>({...p,groupId:e.target.value}))}
              placeholder="輸入 Group ID" required
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm w-52 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 bg-white" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">結算期間</label>
            <input type="month" value={settleForm.period} onChange={e=>setSettleForm(p=>({...p,period:e.target.value}))} required
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 bg-white" />
          </div>
          <button type="submit" disabled={settling} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl text-sm font-medium disabled:opacity-50 transition">
            {settling?'執行中…':'執行月結'}
          </button>
          {settleMsg&&(
            <span className={`text-sm font-medium ${settleMsg.ok?'text-green-600':'text-red-500'}`}>
              {settleMsg.ok?'✅':'❌'} {settleMsg.text}
            </span>
          )}
        </form>
      </div>

      {/* Table */}
      {loading ? <div className="flex justify-center py-16"><div className="w-7 h-7 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div> : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
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
