'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'

type Item = { productName: string; qty: number; unitPrice: number }
type OrderDetail = {
  id: string
  orderNumber: string | null
  status: string
  subtotal: number
  discountAmount: number
  totalPaid: number
  paymentMethod: string
  paidAt: string | null
  createdAt: string
  bundleId: string | null
  retryCount: number
  failureReason: string | null
  wmOrderId: string | null
  wmOrderSn: string | null
  esimRcode: string | null
  esimQrcode: string | null
  esimIccid: string | null
  activationStart: string | null
  activationEnd: string | null
  redeemedAt: string | null
  activatedAt: string | null
  tapPayRecTradeId: string | null
  user: { displayName: string; lineUid: string; phone: string | null; email: string | null }
  orderItems: Item[]
  orderCoupons: { coupon: { type: string; discount: number } }[]
  commission: { commissionAmount: number; ownerRate: number; status: string } | null
}
type Sibling = { id: string; orderNumber: string | null; status: string; orderItems: { productName: string }[] }

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
function fold(d: number) { const n = Math.round(d * 100); return n % 10 === 0 ? `${n / 10} 折` : `${n} 折` }
function dt(s: string | null) { return s ? new Date(s).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—' }

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-400 flex-shrink-0">{label}</span>
      <span className="text-sm text-gray-700 text-right break-all">{children}</span>
    </div>
  )
}
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <h2 className="text-sm font-semibold text-gray-800 mb-2">{title}</h2>
      {children}
    </div>
  )
}

export default function PlatformOrderDetail() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [siblings, setSiblings] = useState<Sibling[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const load = useCallback(async () => {
    const r = await fetch(`/api/platform/orders/${id}`)
    if (r.status === 401) { router.replace('/platform/login'); return }
    const d = await r.json()
    if (d.order) { setOrder(d.order); setSiblings(d.siblings ?? []) }
    setLoading(false)
  }, [id, router])
  useEffect(() => { load() }, [load])

  const act = async (action: 'retry_esim' | 'refund') => {
    if (action === 'refund' && !window.confirm('確定要退款此訂單？將同步退 TapPay、取消分潤、作廢相關優惠券。')) return
    setActing(true); setMsg(null)
    const r = await fetch(`/api/platform/orders/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    }).then(x => x.json()).catch(() => ({ error: '連線失敗' }))
    setActing(false)
    if (r.error) { setMsg({ ok: false, text: r.error }); return }
    setMsg({ ok: true, text: action === 'refund' ? `已退款 NT$${(r.refundedAmount ?? 0).toLocaleString()}` : '已觸發補發流程，稍候重新整理查看' })
    load()
  }

  if (loading) return <div className="text-gray-400 text-sm p-8">載入中…</div>
  if (!order) return <div className="p-8 text-center text-gray-400 text-sm">訂單不存在</div>

  const s = STATUS[order.status] ?? { text: order.status, cls: 'bg-gray-100 text-gray-500' }
  const canRetry = order.status === 'PAID' || order.status === 'ESIM_PENDING'
  const canRefund = ['PAID', 'COMPLETED', 'ESIM_PENDING'].includes(order.status)

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/platform/orders')} className="text-gray-400 hover:text-gray-600 text-sm">← 訂單管理</button>
        <span className="text-gray-300">/</span>
        <h1 className="font-mono text-lg font-bold text-gray-800">{order.orderNumber ?? `#${order.id.slice(-8).toUpperCase()}`}</h1>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${s.cls}`}>{s.text}</span>
      </div>

      {/* Actions */}
      {(canRetry || canRefund) && (
        <div className="flex gap-2">
          {canRetry && <button onClick={() => act('retry_esim')} disabled={acting} className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-xl disabled:opacity-50">補發 eSIM</button>}
          {canRefund && <button onClick={() => act('refund')} disabled={acting} className="bg-red-50 hover:bg-red-100 text-red-600 text-sm font-medium px-4 py-2 rounded-xl disabled:opacity-50">退款</button>}
        </div>
      )}
      {msg && <p className={`text-sm ${msg.ok ? 'text-green-600' : 'text-red-500'}`}>{msg.text}</p>}

      {/* eSIM 狀態（最關鍵：卡在處理中時看這裡）*/}
      <Card title="eSIM 狀態">
        <div className="space-y-0.5">
          <Row label="方案">
            {order.orderItems.map((it, i) => <div key={i}>{it.productName}{it.qty > 1 ? ` × ${it.qty}` : ''}</div>)}
          </Row>
          <Row label="兌換碼 rcode">{order.esimRcode ?? <span className="text-gray-300">尚未取得</span>}</Row>
          <Row label="QR Code">{order.esimQrcode ? <a href={order.esimQrcode} target="_blank" rel="noreferrer" className="text-blue-600 underline">開啟</a> : <span className="text-gray-300">—</span>}</Row>
          <Row label="ICCID">{order.esimIccid ?? <span className="text-gray-300">—</span>}</Row>
          <Row label="可用期間">{order.activationStart ? `${dt(order.activationStart)} ~ ${dt(order.activationEnd)}` : <span className="text-gray-300">—</span>}</Row>
          <Row label="開始安裝 / 啟用">{order.redeemedAt ? dt(order.redeemedAt) : '—'} / {order.activatedAt ? dt(order.activatedAt) : '—'}</Row>
          <Row label="世界移動單號">{order.wmOrderId ?? <span className="text-gray-300">尚未下單</span>}{order.wmOrderSn ? `（${order.wmOrderSn}）` : ''}</Row>
          {order.retryCount > 0 && <Row label="補發重試">{order.retryCount} 次</Row>}
          {order.failureReason && (
            <div className="mt-2 bg-red-50 border border-red-100 rounded-lg p-3">
              <p className="text-xs font-semibold text-red-700">開卡/付款失敗原因</p>
              <p className="text-sm text-red-600 mt-0.5">{order.failureReason}</p>
            </div>
          )}
        </div>
      </Card>

      {/* 金額 */}
      <Card title="金額明細">
        <Row label="原價">NT${order.subtotal.toLocaleString()}</Row>
        <Row label="折扣">- NT${order.discountAmount.toLocaleString()}</Row>
        <Row label="實付"><span className="font-semibold text-gray-800">NT${order.totalPaid.toLocaleString()}</span></Row>
        <Row label="付款方式">{order.paymentMethod === 'CREDIT_CARD' ? '信用卡' : 'LINE Pay'}</Row>
        <Row label="付款 / 建立時間">{dt(order.paidAt)} / {dt(order.createdAt)}</Row>
        {order.tapPayRecTradeId && <Row label="TapPay 交易號"><span className="font-mono text-xs select-all">{order.tapPayRecTradeId}</span></Row>}
        {order.orderCoupons.length > 0 && (
          <Row label="使用優惠券">{order.orderCoupons.map(c => `${COUPON_LABEL[c.coupon.type] ?? c.coupon.type}（${fold(c.coupon.discount)}）`).join('、')}</Row>
        )}
        {order.commission && (
          <Row label="社群分潤">NT${order.commission.commissionAmount.toLocaleString()}（{Math.round(Number(order.commission.ownerRate) * 100)}%・{order.commission.status === 'SETTLED' ? '已結算' : order.commission.status === 'CANCELLED' ? '已取消' : '待結算'}）</Row>
        )}
      </Card>

      {/* 會員 */}
      <Card title="會員">
        <Row label="暱稱">{order.user.displayName}</Row>
        <Row label="手機">{order.user.phone ?? <span className="text-gray-300">未填</span>}</Row>
        <Row label="Email">{order.user.email ?? <span className="text-gray-300">未填</span>}</Row>
        <Row label="LINE UID"><span className="font-mono text-xs">{order.user.lineUid}</span></Row>
      </Card>

      {/* 同捆訂單（多張 eSIM）*/}
      {siblings.length > 0 && (
        <Card title={`同捆訂單（共 ${siblings.length + 1} 張 eSIM）`}>
          <div className="space-y-1.5">
            {siblings.map(sb => {
              const ss = STATUS[sb.status] ?? { text: sb.status, cls: 'bg-gray-100 text-gray-500' }
              return (
                <button key={sb.id} onClick={() => router.push(`/platform/orders/${sb.id}`)} className="w-full flex items-center justify-between bg-gray-50 hover:bg-gray-100 rounded-lg px-3 py-2 transition text-left">
                  <span className="text-sm text-gray-700">{sb.orderItems[0]?.productName ?? '—'}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ss.cls}`}>{ss.text}</span>
                </button>
              )
            })}
          </div>
        </Card>
      )}
    </div>
  )
}
