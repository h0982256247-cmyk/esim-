'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import RefundConfirmDialog, { type RefundTarget } from '@/components/platform/RefundConfirmDialog'

type CouponLine = { coupon: { type: string; discount: number } }
type Commission = { commissionAmount: number; ownerRate: number; status: string } | null
type OrderItem = { productName: string; qty: number }
type Esim = {
  id: string
  orderNumber: string | null
  status: string
  bundleSeq: number | null
  subtotal: number
  discountAmount: number
  totalPaid: number
  orderItems: OrderItem[]
  orderCoupons: CouponLine[]
  commission: Commission
  esimRcode: string | null
  esimQrcode: string | null
  esimIccid: string | null
  activationStart: string | null
  activationEnd: string | null
  redeemedAt: string | null
  activatedAt: string | null
  wmOrderId: string | null
  wmOrderSn: string | null
  retryCount: number
  failureReason: string | null
}
type Detail = {
  orderNumber: string | null
  bundleId: string | null
  focusedId: string
  user: { displayName: string; lineUid: string; phone: string | null; email: string | null }
  payment: { paymentMethod: string; paidAt: string | null; createdAt: string; tapPayRecTradeId: string | null }
  esims: Esim[]
}

const STATUS: Record<string, { text: string; cls: string }> = {
  PENDING:      { text: '待付款',   cls: 'bg-yellow-50 text-yellow-600' },
  PROCESSING:   { text: '待付款',   cls: 'bg-yellow-50 text-yellow-600' },
  PAID:         { text: '已付款',   cls: 'bg-blue-50 text-blue-600' },
  COMPLETED:    { text: '已完成發送', cls: 'bg-green-50 text-green-600' },
  ESIM_PENDING: { text: '待發送',   cls: 'bg-orange-50 text-orange-600' },
  FAILED:       { text: '付款失敗', cls: 'bg-red-50 text-red-500' },
  CANCELLED:    { text: '已取消',   cls: 'bg-gray-100 text-gray-400' },
  REFUNDED:     { text: '已退款',   cls: 'bg-red-50 text-red-500' },
}
const COUPON_LABEL: Record<string, string> = {
  OFFICIAL_WELCOME: '官方歡迎券', GROUP_JOIN: '入群券', GROUP_REPURCHASE: '回購券',
  GROUP_OWNER: '社群主券', GROUP_ACTIVITY: '活動券',
}
const COMMISSION_STATUS: Record<string, string> = { SETTLED: '已結算', CANCELLED: '已取消', PENDING: '待結算' }
function fold(d: number) { const n = Math.round(d * 100); return n % 10 === 0 ? `${n / 10} 折` : `${n} 折` }
function dt(s: string | null) { return s ? new Date(s).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—' }
const dash = <span className="text-gray-300">—</span>

function Pill({ status }: { status: string }) {
  const s = STATUS[status] ?? { text: status, cls: 'bg-gray-100 text-gray-500' }
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${s.cls}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />{s.text}
    </span>
  )
}

function Row({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-400 flex-shrink-0">{label}</span>
      <span className={`text-right break-all text-gray-700 ${mono ? 'font-mono text-xs select-all' : 'text-sm'}`}>{value}</span>
    </div>
  )
}

function SummaryCell({ label, value, mono, full }: { label: string; value: React.ReactNode; mono?: boolean; full?: boolean }) {
  return (
    <div className={full ? 'col-span-2' : ''}>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className={`text-gray-800 break-all ${mono ? 'font-mono text-xs select-all' : 'text-sm font-medium'}`}>{value}</p>
    </div>
  )
}

export default function PlatformOrderDetail() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [d, setD] = useState<Detail | null>(null)
  const [loading, setLoading] = useState(true)
  const [actingId, setActingId] = useState<string | null>(null)
  const [refundTarget, setRefundTarget] = useState<RefundTarget | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const load = useCallback(async () => {
    const r = await fetch(`/api/platform/orders/${id}`)
    if (r.status === 401) { router.replace('/platform/login'); return }
    const j = await r.json()
    if (j.esims) setD(j)
    setLoading(false)
  }, [id, router])
  useEffect(() => { load() }, [load])

  // 補發單張 eSIM（無金流風險，直接觸發；後端具冪等守門）
  const retry = async (orderId: string) => {
    setActingId(orderId); setMsg(null)
    const r = await fetch(`/api/platform/orders/${orderId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'retry_esim' }),
    }).then(x => x.json()).catch(() => ({ error: '連線失敗' }))
    setActingId(null)
    if (r.error) { setMsg({ ok: false, text: r.error }); return }
    setMsg({ ok: true, text: '已觸發補發流程，稍候重新整理查看' })
    load()
  }

  const REFUNDABLE = (s: string) => s === 'PAID' || s === 'COMPLETED' || s === 'ESIM_PENDING'
  const ACTIVE = (s: string) => !['REFUNDED', 'CANCELLED', 'FAILED'].includes(s)

  // 退款單張：抓該張預覽；判斷「退完後整捆是否全退」決定是否退券（只有全退才退券）。
  const openRefund = async (e: Esim) => {
    setActingId(e.id)
    const j = await fetch(`/api/platform/orders/${e.id}`).then(x => x.json()).catch(() => null)
    setActingId(null)
    const all = d?.esims ?? [e]
    const othersActive = all.some(x => x.id !== e.id && ACTIVE(x.status))
    setRefundTarget({
      id: e.id, orderNumber: e.orderNumber, status: e.status, scope: 'single',
      amount: e.totalPaid, count: 1,
      restoresCoupons: !othersActive,
      preview: j?.refundPreview ?? null,
    })
  }

  // 整捆退款：退所有仍可退的 eSIM、金額為合計，會退還／作廢優惠券。
  const openBundleRefund = async () => {
    if (!d) return
    const refundable = d.esims.filter(e => REFUNDABLE(e.status))
    if (refundable.length === 0) return
    setActingId('bundle')
    const j = await fetch(`/api/platform/orders/${d.focusedId}?scope=bundle`).then(x => x.json()).catch(() => null)
    setActingId(null)
    setRefundTarget({
      id: d.focusedId, orderNumber: d.orderNumber, status: refundable[0].status, scope: 'bundle',
      amount: refundable.reduce((s, e) => s + e.totalPaid, 0),
      count: refundable.length,
      restoresCoupons: true,
      preview: j?.refundPreview ?? null,
    })
  }

  const doRefund = async (t: RefundTarget): Promise<{ ok: boolean; message: string }> => {
    const r = await fetch(`/api/platform/orders/${t.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: t.scope === 'bundle' ? 'refund_bundle' : 'refund' }),
    }).then(x => x.json()).catch(() => ({ error: '連線失敗' }))
    if (r.error) return { ok: false, message: r.error }
    const parts = [`已退還 NT$${(r.refundedAmount ?? 0).toLocaleString()}${r.refundedCount > 1 ? `（${r.refundedCount} 張 eSIM）` : ''}`]
    if (r.restoredCoupons > 0) parts.push(`歸還優惠券 ${r.restoredCoupons} 張`)
    if (r.voidedCoupons > 0) parts.push(`作廢回購券 ${r.voidedCoupons} 張`)
    load()
    return { ok: true, message: parts.join('\n') }
  }

  if (loading) return <div className="text-gray-400 text-sm p-8">載入中…</div>
  if (!d) return <div className="p-8 text-center text-gray-400 text-sm">訂單不存在</div>

  const { user, payment } = d
  const esims = d.esims
  const isBundle = esims.length > 1
  const totalPaid = esims.reduce((s, e) => s + e.totalPaid, 0)
  const refundableCount = esims.filter(e => REFUNDABLE(e.status)).length

  return (
    <div className="max-w-3xl mx-auto space-y-4 pb-12">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => router.push('/platform/orders')} className="text-gray-400 hover:text-gray-600 text-sm">← 訂單管理</button>
        <span className="text-gray-300">/</span>
        <h1 className="font-mono text-lg font-bold text-gray-800">{d.orderNumber ?? `#${d.focusedId.slice(-8).toUpperCase()}`}</h1>
        {isBundle && <span className="text-xs font-semibold text-violet-600 bg-violet-50 px-2.5 py-1 rounded-full">合購 · {esims.length} 張 eSIM</span>}
        {isBundle && refundableCount > 1 && (
          <button onClick={openBundleRefund} disabled={actingId === 'bundle'} className="ml-auto text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg disabled:opacity-50 font-medium transition">
            {actingId === 'bundle' ? '…' : `整捆退款（${refundableCount} 張）`}
          </button>
        )}
      </div>
      {msg && <p className={`text-sm ${msg.ok ? 'text-green-600' : 'text-red-500'}`}>{msg.text}</p>}

      {/* 訂單摘要（會員 + 付款，整捆共用） */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-800">訂單摘要</h2>
          <div className="text-right">
            <span className="text-xs text-gray-400">{isBundle ? '合計實付' : '實付'}</span>
            <span className="ml-2 text-xl font-extrabold text-gray-900">NT${totalPaid.toLocaleString()}</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
          <SummaryCell label="會員" value={user.displayName} />
          <SummaryCell label="付款方式" value={payment.paymentMethod === 'CREDIT_CARD' ? '信用卡' : 'LINE Pay'} />
          <SummaryCell label="手機" value={user.phone ?? <span className="text-gray-300">未填</span>} />
          <SummaryCell label="付款 / 建立時間" value={`${dt(payment.paidAt)} / ${dt(payment.createdAt)}`} />
          <SummaryCell label="Email" value={user.email ?? <span className="text-gray-300">未填</span>} />
          <SummaryCell label="LINE UID" value={user.lineUid} mono />
          {payment.tapPayRecTradeId && <SummaryCell label="TapPay 交易號" value={payment.tapPayRecTradeId} mono full />}
        </div>
      </div>

      {/* eSIM 卡片清單（多張並列，逐張可補發 / 退款） */}
      {esims.map((e, i) => {
        const canRetry = e.status === 'PAID' || e.status === 'ESIM_PENDING'
        const canRefund = ['PAID', 'COMPLETED', 'ESIM_PENDING'].includes(e.status)
        const busy = actingId === e.id
        const pname = e.orderItems[0]?.productName ?? '—'
        return (
          <div key={e.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* 卡片標頭：序號 + 狀態 + 操作 */}
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-50">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {isBundle && <span className="text-xs font-bold text-white bg-gray-900 rounded-md px-1.5 py-0.5">eSIM {i + 1}</span>}
                  <Pill status={e.status} />
                </div>
                <p className="text-sm font-semibold text-gray-800 mt-1.5 truncate">{pname}</p>
                {isBundle && e.orderNumber && <p className="text-xs text-gray-400 font-mono mt-0.5">{e.orderNumber}</p>}
              </div>
              {(canRetry || canRefund) && (
                <div className="flex gap-2 flex-shrink-0">
                  {canRetry && <button onClick={() => retry(e.id)} disabled={busy} className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg disabled:opacity-50 font-medium transition">{busy ? '…' : '補發'}</button>}
                  {canRefund && <button onClick={() => openRefund(e)} disabled={busy} className="text-xs bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-lg disabled:opacity-50 font-medium transition">{busy ? '…' : '退款'}</button>}
                </div>
              )}
            </div>

            {/* eSIM 開卡資訊 */}
            <div className="px-5 py-2">
              <Row label="兌換碼 rcode" value={e.esimRcode ?? <span className="text-gray-300">尚未取得</span>} mono />
              <Row label="QR Code" value={e.esimQrcode ? <a href={e.esimQrcode} target="_blank" rel="noreferrer" className="text-blue-600 underline text-sm">開啟</a> : dash} />
              <Row label="ICCID" value={e.esimIccid ?? dash} mono />
              <Row label="可用期間" value={e.activationStart ? `${dt(e.activationStart)} ~ ${dt(e.activationEnd)}` : dash} />
              <Row label="開始安裝 / 啟用" value={`${e.redeemedAt ? dt(e.redeemedAt) : '—'} / ${e.activatedAt ? dt(e.activatedAt) : '—'}`} />
              <Row label="世界移動單號" value={e.wmOrderId ? `${e.wmOrderId}${e.wmOrderSn ? `（${e.wmOrderSn}）` : ''}` : <span className="text-gray-300">尚未下單</span>} mono />
              {e.retryCount > 0 && <Row label="補發重試" value={`${e.retryCount} 次`} />}
            </div>

            {e.failureReason && (
              <div className="mx-5 mb-3 bg-red-50 border border-red-100 rounded-lg p-3">
                <p className="text-xs font-semibold text-red-700">開卡 / 付款失敗原因</p>
                <p className="text-sm text-red-600 mt-0.5">{e.failureReason}</p>
              </div>
            )}

            {/* 金額（逐張） */}
            <div className="px-5 py-3 bg-gray-50/70 border-t border-gray-100 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-gray-500">
              <span>實付 <b className="text-sm text-gray-900">NT${e.totalPaid.toLocaleString()}</b></span>
              {e.discountAmount > 0 && <span>原價 NT${e.subtotal.toLocaleString()}・折 NT${e.discountAmount.toLocaleString()}</span>}
              {e.orderCoupons.length > 0 && <span>{e.orderCoupons.map(c => `${COUPON_LABEL[c.coupon.type] ?? c.coupon.type}（${fold(c.coupon.discount)}）`).join('、')}</span>}
              {e.commission && <span>分潤 NT${e.commission.commissionAmount}（{Math.round(Number(e.commission.ownerRate) * 100)}%・{COMMISSION_STATUS[e.commission.status] ?? e.commission.status}）</span>}
            </div>
          </div>
        )
      })}

      <RefundConfirmDialog target={refundTarget} onClose={() => setRefundTarget(null)} onConfirm={doRefund} />
    </div>
  )
}
