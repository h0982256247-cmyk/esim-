'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useLiffBase } from '@/hooks/useLiffBase'
import { useTenantColors } from '@/components/liff/TenantContext'

type OrderDetail = {
  id: string
  orderNumber: string | null
  status: string
  totalPaid: number
  subtotal: number
  discountAmount: number
  paymentMethod: string
  paidAt: string | null
  createdAt: string
  esimRcode: string | null
  esimQrcode: string | null
  esimLpa: string | null
  esimIccid: string | null
  activationStart: string | null
  activationEnd: string | null
  orderItems: { productName: string; qty: number; unitPrice: number }[]
}

type EsimUsage = {
  iccid: string
  totalData: number
  usedData: number
  remainingData: number
  unit: string
}

const STATUS_META: Record<string, { text: string; bg: string; color: string }> = {
  PENDING:      { text: '待付款',       bg: '#fef9c3', color: '#a16207' },
  PROCESSING:   { text: '付款中',       bg: '#e0f2fe', color: '#0369a1' },
  PAID:         { text: '付款成功',     bg: '#dcfce7', color: '#15803d' },
  COMPLETED:    { text: '已完成',       bg: '#d1fae5', color: '#065f46' },
  FAILED:       { text: '付款失敗',     bg: '#fee2e2', color: '#b91c1c' },
  ESIM_PENDING: { text: 'eSIM 處理中',  bg: '#ffedd5', color: '#c2410c' },
  REFUNDED:     { text: '已退款',       bg: '#f1f5f9', color: '#475569' },
  CANCELLED:    { text: '已取消',       bg: '#f1f5f9', color: '#94a3b8' },
}

const S = {
  white: '#ffffff', ink: '#1a1a1a', muted: '#4b5563', faint: '#94a3b8',
  line: 'rgba(0,0,0,0.07)',
} as const

function UsageBar({ used, total }: { used: number; total: number }) {
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0
  const color = pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : '#22c55e'
  return (
    <div style={{ background: '#f1f5f9', borderRadius: 100, height: 8, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 100, transition: 'width 0.6s ease' }} />
    </div>
  )
}

function formatData(mb: number, unit: string): string {
  if (unit === 'GB' || mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`
  return `${mb.toLocaleString()} MB`
}

export default function OrderDetailPage() {
  const router = useRouter()
  const base = useLiffBase()
  const { id } = useParams<{ id: string }>()
  const C = useTenantColors()
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [usage, setUsage] = useState<EsimUsage | null>(null)
  const [usageLoading, setUsageLoading] = useState(false)
  const [usageError, setUsageError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>
    const POLLING_STATUSES = ['PROCESSING', 'PAID', 'ESIM_PENDING']
    const load = () =>
      fetch(`/api/orders/${id}`)
        .then(r => { if (r.status === 404) setNotFound(true); return r.json() })
        .then(d => {
          if (d.order) setOrder(d.order)
          if (POLLING_STATUSES.includes(d.order?.status)) {
            if (!timer) timer = setInterval(load, 4000)
          } else {
            clearInterval(timer)
          }
        })
        .finally(() => setLoading(false))
    load()
    return () => clearInterval(timer)
  }, [id])

  const fetchUsage = async () => {
    setUsageLoading(true)
    setUsageError(null)
    try {
      const res = await fetch(`/api/orders/${id}/usage`)
      const data = await res.json()
      if (data.usage) setUsage(data.usage)
      else setUsageError(data.error ?? '無法取得用量')
    } catch {
      setUsageError('查詢失敗，請稍後再試')
    } finally {
      setUsageLoading(false)
    }
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ width: 28, height: 28, border: `2.5px solid ${C.light}`, borderTopColor: C.primary, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (notFound || !order) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 12 }}>
      <p style={{ color: S.faint }}>訂單不存在</p>
      <button onClick={() => router.push(`${base}/orders`)} style={{ color: C.primary, fontSize: 14, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
        查看所有訂單
      </button>
    </div>
  )

  const s = STATUS_META[order.status] ?? { text: order.status, bg: '#f1f5f9', color: '#475569' }

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: '20px 16px 96px' }}>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <button onClick={() => router.push(`${base}/orders`)} style={{ fontSize: 13, color: C.primary, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          所有訂單
        </button>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: S.ink, margin: 0, letterSpacing: '-0.02em' }}>訂單詳情</h1>
          <span style={{
            fontSize: 11, fontWeight: 700,
            background: s.bg, color: s.color,
            padding: '3px 10px', borderRadius: 100,
          }}>
            {s.text}
          </span>
        </div>
        <p style={{ fontSize: 12, color: S.faint, marginTop: 4 }}>{order.orderNumber ?? `#${order.id.slice(-8).toUpperCase()}`}</p>
      </div>

      {/* eSIM 啟動碼 */}
      {order.status === 'COMPLETED' && order.esimRcode && (
        <div style={{ background: C.light, border: `1px solid ${C.border}`, borderRadius: 16, padding: '20px', marginBottom: 12 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: S.ink, margin: '0 0 14px' }}>eSIM 啟動碼</h2>

          {order.esimQrcode && (
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={order.esimQrcode} alt="eSIM QR Code" style={{ width: 140, height: 140, borderRadius: 12, background: '#fff', padding: 4 }} />
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
            <div>
              <span style={{ color: S.muted, display: 'block', marginBottom: 2 }}>啟動碼</span>
              <span style={{ fontFamily: 'ui-monospace, monospace', color: S.ink, wordBreak: 'break-all', fontWeight: 600 }}>{order.esimRcode}</span>
            </div>
            {order.esimLpa && (
              <div>
                <span style={{ color: S.muted, display: 'block', marginBottom: 2 }}>LPA（iOS 一鍵安裝）</span>
                <span style={{ fontFamily: 'ui-monospace, monospace', color: S.ink, fontSize: 11, wordBreak: 'break-all' }}>{order.esimLpa}</span>
              </div>
            )}
            {order.activationStart && order.activationEnd && (
              <div>
                <span style={{ color: S.muted, display: 'block', marginBottom: 2 }}>使用期間</span>
                <span style={{ color: S.ink, fontWeight: 600 }}>
                  {new Date(order.activationStart).toLocaleDateString('zh-TW')} ～ {new Date(order.activationEnd).toLocaleDateString('zh-TW')}
                </span>
              </div>
            )}
          </div>

          {/* 流量使用狀況 */}
          {order.esimIccid && (
            <div style={{ marginTop: 16, borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: S.ink }}>流量使用狀況</span>
                <button
                  onClick={fetchUsage}
                  disabled={usageLoading}
                  style={{
                    fontSize: 12, color: C.primary,
                    background: usageLoading ? C.light : S.white,
                    border: `1px solid ${C.border}`, borderRadius: 100, padding: '5px 14px',
                    cursor: usageLoading ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600,
                  }}
                >
                  {usageLoading ? (
                    <>
                      <span style={{ display: 'inline-block', width: 10, height: 10, border: `1.5px solid ${C.light}`, borderTopColor: C.primary, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                      查詢中
                    </>
                  ) : '查詢流量'}
                </button>
              </div>

              {usageError && <p style={{ fontSize: 12, color: '#ef4444', margin: '0 0 8px' }}>{usageError}</p>}

              {usage ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <UsageBar used={usage.usedData} total={usage.totalData} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: S.muted }}>已用 <strong style={{ color: S.ink }}>{formatData(usage.usedData, usage.unit)}</strong></span>
                    <span style={{ color: S.muted }}>剩餘 <strong style={{ color: '#16a34a' }}>{formatData(usage.remainingData, usage.unit)}</strong></span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: S.faint }}>總流量 {formatData(usage.totalData, usage.unit)}</span>
                    <span style={{ fontSize: 11, color: S.faint }}>ICCID: {usage.iccid.slice(-8)}</span>
                  </div>
                </div>
              ) : !usageError && (
                <p style={{ fontSize: 12, color: S.faint, margin: 0 }}>點擊「查詢流量」取得即時用量資料</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* 已取消 */}
      {order.status === 'CANCELLED' && (
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 16, padding: '18px 20px', marginBottom: 12 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#475569', margin: '0 0 4px' }}>訂單已取消</p>
          <p style={{ fontSize: 13, color: '#94a3b8', margin: 0, lineHeight: 1.6 }}>
            此訂單因超過 30 分鐘未完成付款，已自動取消。如需購買請重新下單。
          </p>
        </div>
      )}

      {/* 付款確認中（3DS 完成後等待 webhook） */}
      {order.status === 'PROCESSING' && (
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 16, padding: '18px 20px', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{ width: 18, height: 18, border: '2.5px solid #bfdbfe', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
            <p style={{ fontSize: 14, fontWeight: 700, color: '#1d4ed8', margin: 0 }}>付款確認中</p>
          </div>
          <p style={{ fontSize: 13, color: '#1e40af', margin: 0, lineHeight: 1.6 }}>
            正在與銀行確認付款結果，通常在幾秒內完成。請勿關閉此頁面。
          </p>
        </div>
      )}

      {/* eSIM 處理中 */}
      {(order.status === 'ESIM_PENDING' || order.status === 'PAID') && (
        <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 16, padding: '18px 20px', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#f97316', animation: 'pulse 1.5s ease-in-out infinite' }} />
            <p style={{ fontSize: 14, fontWeight: 700, color: '#c2410c', margin: 0 }}>eSIM 啟動碼準備中</p>
          </div>
          <p style={{ fontSize: 13, color: '#ea580c', margin: 0, lineHeight: 1.6 }}>
            系統正在取得啟動碼，通常在幾分鐘內完成。若超過 30 分鐘仍未收到，請聯繫客服。
          </p>
          <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
        </div>
      )}

      {/* 訂單資訊 */}
      <div style={{ background: S.white, borderRadius: 16, border: `1px solid ${S.line}`, padding: '18px 20px', marginBottom: 12 }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: S.ink, margin: '0 0 14px' }}>訂單資訊</p>
        <div style={{ marginBottom: 14 }}>
          <p style={{ fontSize: 12, color: S.faint, margin: '0 0 4px' }}>商品</p>
          <p style={{ fontSize: 15, fontWeight: 600, color: S.ink, margin: 0 }}>{order.orderItems[0]?.productName ?? '—'}</p>
        </div>
        <div style={{ borderTop: `1px solid ${S.line}`, paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: S.muted }}>
            <span>商品原價</span><span>NT${order.subtotal.toLocaleString()}</span>
          </div>
          {order.discountAmount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#16a34a' }}>
              <span>優惠折扣</span><span>-NT${order.discountAmount.toLocaleString()}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 800, borderTop: `1px solid ${S.line}`, paddingTop: 12, marginTop: 2 }}>
            <span style={{ color: S.ink }}>實付金額</span>
            <span style={{ color: C.primary, letterSpacing: '-0.02em' }}>NT${order.totalPaid.toLocaleString()}</span>
          </div>
        </div>
        <div style={{ borderTop: `1px solid ${S.line}`, paddingTop: 12, marginTop: 4, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12, color: S.faint }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>付款方式</span>
            <span>{order.paymentMethod === 'CREDIT_CARD' ? '信用卡' : 'LINE Pay'}</span>
          </div>
          {order.paidAt && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>付款時間</span>
              <span>{new Date(order.paidAt).toLocaleString('zh-TW')}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>下單時間</span>
            <span>{new Date(order.createdAt).toLocaleString('zh-TW')}</span>
          </div>
        </div>
      </div>

      {/* 客服 */}
      <div style={{ textAlign: 'center', marginTop: 12 }}>
        <button onClick={() => router.push(`${base}/support`)} style={{ fontSize: 13, color: S.faint, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
          需要協助？聯絡客服
        </button>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
