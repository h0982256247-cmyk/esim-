'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import TenantScopeBar from '@/components/platform/TenantScopeBar'

type Order = {
  id: string; status: string; totalPaid: number; paymentMethod: string
  paidAt: string | null; createdAt: string; retryCount: number
  orderNumber: string | null; tapPayOrderId: string | null
  user: { displayName: string }
  orderItems: { productName: string }[]
}
const STATUS_OPTS = ['','PENDING','PROCESSING','PAID','COMPLETED','FAILED','ESIM_PENDING','REFUNDED','CANCELLED']
const STATUS: Record<string,{text:string;cls:string}> = {
  PENDING:      {text:'待付款',cls:'bg-yellow-50 text-yellow-600'},
  PROCESSING:   {text:'付款中',cls:'bg-blue-50 text-blue-500'},
  PAID:         {text:'付款成功',cls:'bg-blue-50 text-blue-600'},
  COMPLETED:    {text:'已完成',cls:'bg-green-50 text-green-600'},
  FAILED:       {text:'付款失敗',cls:'bg-red-50 text-red-500'},
  ESIM_PENDING: {text:'eSIM 待補',cls:'bg-orange-50 text-orange-600'},
  REFUNDED:     {text:'已退款',cls:'bg-gray-100 text-gray-400'},
  CANCELLED:    {text:'已取消',cls:'bg-gray-100 text-gray-400'},
}
const COLORS=['bg-blue-500','bg-violet-500','bg-emerald-500','bg-amber-500','bg-rose-500']
const avatarCls=(n:string)=>COLORS[n.charCodeAt(0)%COLORS.length]
const initials=(n:string)=>n.slice(0,2).toUpperCase()

export default function PlatformOrdersPage() {
  return <Suspense fallback={<div className="flex justify-center py-16"><div className="w-7 h-7 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>}><OrdersContent /></Suspense>
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
  const [platformAdmins, setPlatformAdmins] = useState<{id:string;name:string;brandName:string|null}[]>([])
  const [filterTenantId, setFilterTenantId] = useState<string>('')

  useEffect(() => {
    fetch('/api/platform/auth/me').then(r=>r.json()).then(d=>{
      if(d.admin){setCurrentRole(d.admin.role);if(d.admin.role==='SUPER_ADMIN'){fetch('/api/platform/admins').then(r=>r.json()).then(a=>{setPlatformAdmins((a.admins??[]).filter((x:{role:string})=>x.role==='PLATFORM_ADMIN'))})}}
    })
  }, [])
  const load = () => {
    setLoading(true)
    fetch(`/api/platform/orders?page=${page}${statusFilter?`&status=${statusFilter}`:''}${filterTenantId?`&tenantAdminId=${filterTenantId}`:''}`)
      .then(r=>r.status===401?(router.replace('/platform/login'),null):r.json())
      .then(d=>{if(d){setOrders(d.orders);setTotal(d.total)}}).finally(()=>setLoading(false))
  }
  useEffect(load, [page,statusFilter,filterTenantId,router])
  const handleRetry = async (id:string) => { setActionLoading(id); await fetch(`/api/platform/orders/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'retry_esim'})}); setActionLoading(null); load() }

  const handleRefund = async (o: Order) => {
    // 依訂單狀態給不同警語
    const baseMsg = `將退還 NT$${o.totalPaid.toLocaleString()} 給用戶（透過 TapPay）。`
    let warning = ''
    if (o.status === 'COMPLETED') {
      warning = '\n\n⚠ 此訂單已完成（用戶已取得 eSIM 兌換碼）\n  · 供應商成本無法回收，平台需自行吸收\n  · 社群主已產生的分潤將自動扣抵'
    } else if (o.status === 'ESIM_PENDING') {
      warning = '\n\n⚠ 此訂單 eSIM 尚未交付\n  · 平台應主動向供應商（世界移動）確認是否計費\n  · 若已計費，平台需自行吸收'
    } else if (o.status === 'PAID') {
      warning = '\n\n⚠ eSIM 流程已啟動，供應商成本可能已產生'
    }
    if (!confirm(baseMsg + warning + '\n\n確定要退款嗎？')) return

    setActionLoading(o.id)
    const r = await fetch(`/api/platform/orders/${o.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'refund' }),
    }).then(x => x.json())
    setActionLoading(null)

    if (r.error) {
      alert(`退款失敗：${r.error}`)
      return
    }
    const parts: string[] = [`✅ 已退款 NT$${r.refundedAmount.toLocaleString()}`]
    if (r.restoredCoupons > 0) parts.push(`歸還優惠券 ${r.restoredCoupons} 張`)
    if (r.voidedCoupons   > 0) parts.push(`作廢回購券 ${r.voidedCoupons} 張`)
    alert(parts.join('\n'))
    load()
  }
  const totalPages = Math.ceil(total/20)
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-gray-800">訂單管理</h1><p className="text-sm text-gray-400 mt-0.5">共 {total} 筆訂單</p></div>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_OPTS.map(s=>(
            <button key={s} onClick={()=>router.push(s?`/platform/orders?status=${s}&page=1`:'/platform/orders?page=1')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-medium border transition ${statusFilter===s?'bg-blue-600 text-white border-blue-600':'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>
              {s?(STATUS[s]?.text??s):'全部'}
            </button>
          ))}
        </div>
      </div>
      {currentRole==='SUPER_ADMIN'&&platformAdmins.length>0&&(
        <TenantScopeBar admins={platformAdmins} value={filterTenantId} onChange={v=>setFilterTenantId(v)} />
      )}
      {loading ? <div className="flex justify-center py-16"><div className="w-7 h-7 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div> : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['訂單','會員','金額','付款方式','狀態','時間','操作'].map(h=>(
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {orders.map(o=>{
                const s=STATUS[o.status]??{text:o.status,cls:'bg-gray-100 text-gray-500'}
                return (
                  <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="font-mono text-xs font-semibold text-gray-700">{o.orderNumber??`#${o.id.slice(-8).toUpperCase()}`}</p>
                      <p className="text-xs text-gray-600 mt-0.5">{o.orderItems[0]?.productName??'—'}</p>
                      {o.tapPayOrderId&&<p className="font-mono text-xs text-gray-300 mt-0.5 select-all">{o.tapPayOrderId}</p>}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-full ${avatarCls(o.user.displayName)} flex items-center justify-center flex-shrink-0`}>
                          <span className="text-white text-xs font-bold">{initials(o.user.displayName)}</span>
                        </div>
                        <span className="text-sm font-medium text-gray-700">{o.user.displayName}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-gray-800">NT${o.totalPaid.toLocaleString()}</td>
                    <td className="px-5 py-3.5 text-xs text-gray-500">{o.paymentMethod==='CREDIT_CARD'?'信用卡':'LINE Pay'}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${s.cls}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70"/>{s.text}
                      </span>
                      {o.retryCount>0&&<span className="block text-xs text-gray-400 mt-0.5">重試 {o.retryCount} 次</span>}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-gray-400">{new Date(o.createdAt).toLocaleDateString('zh-TW')}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex gap-1.5">
                        {o.status==='ESIM_PENDING'&&(
                          <button onClick={()=>handleRetry(o.id)} disabled={actionLoading===o.id} className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg disabled:opacity-50 font-medium transition">補發</button>
                        )}
                        {(o.status==='PAID'||o.status==='COMPLETED'||o.status==='ESIM_PENDING')&&(
                          <button onClick={()=>handleRefund(o)} disabled={actionLoading===o.id} className="text-xs bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-lg disabled:opacity-50 font-medium transition">退款</button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {orders.length===0&&<div className="text-center py-12"><p className="text-gray-400 text-sm">目前沒有符合條件的訂單</p></div>}
        </div>
      )}
      {totalPages>1&&(
        <div className="flex justify-center gap-1.5">
          {Array.from({length:Math.min(totalPages,10)},(_,i)=>i+1).map(p=>(
            <button key={p} onClick={()=>router.push(`/platform/orders?status=${statusFilter}&page=${p}`)}
              className={`w-9 h-9 rounded-xl text-sm font-medium transition ${p===page?'bg-blue-600 text-white':'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'}`}>{p}</button>
          ))}
        </div>
      )}
    </div>
  )
}
