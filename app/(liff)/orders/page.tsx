'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { EmptyOrdersIllustration } from '@/components/liff/LiffIllustrations'
import { useTenantColors } from '@/components/liff/TenantContext'

type Order = {
  id: string
  status: string
  totalPaid: number
  createdAt: string
  orderItems: { productName: string; qty: number; unitPrice: number }[]
}

const S = {
  white: '#ffffff', ink: '#1a1a1a', muted: '#4b5563', faint: '#94a3b8',
  line: 'rgba(0,0,0,0.07)',
} as const

const STATUS_META: Record<string, { text: string; bg: string; color: string }> = {
  PENDING:      { text: '待付款',      bg: '#fef9c3', color: '#a16207' },
  PROCESSING:   { text: '付款中',      bg: '#e0f2fe', color: '#0369a1' },
  PAID:         { text: '付款成功',    bg: '#dcfce7', color: '#15803d' },
  COMPLETED:    { text: '已完成',      bg: '#d1fae5', color: '#065f46' },
  FAILED:       { text: '付款失敗',    bg: '#fee2e2', color: '#b91c1c' },
  ESIM_PENDING: { text: 'eSIM 處理中', bg: '#ffedd5', color: '#c2410c' },
  REFUNDED:     { text: '已退款',      bg: '#f1f5f9', color: '#475569' },
}

function ChevronRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={S.faint} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

export default function OrdersPage() {
  const router = useRouter()
  const C = useTenantColors()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/orders').then(r => r.json()).then(d => setOrders(d.orders ?? [])).finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ width: 28, height: 28, border: `2.5px solid ${C.light}`, borderTopColor: C.primary, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', paddingBottom: 96 }}>
      <div style={{ padding: '24px 20px 16px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: S.ink, margin: 0, letterSpacing: '-0.02em' }}>我的訂單</h1>
      </div>

      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {orders.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '48px 0' }}>
            <EmptyOrdersIllustration size={80} />
            <p style={{ fontSize: 14, color: S.faint }}>目前沒有訂單紀錄</p>
          </div>
        )}
        {orders.map(o => {
          const s = STATUS_META[o.status] ?? { text: o.status, bg: '#f1f5f9', color: '#475569' }
          return (
            <button
              key={o.id}
              onClick={() => router.push(`/orders/${o.id}`)}
              style={{
                width: '100%', textAlign: 'left', background: S.white,
                borderRadius: 16, border: `1px solid ${S.line}`,
                padding: '16px', cursor: 'pointer',
                boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                display: 'flex', alignItems: 'center', gap: 12,
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{
                    fontSize: 11, fontWeight: 700,
                    background: s.bg, color: s.color,
                    padding: '3px 10px', borderRadius: 100,
                  }}>
                    {s.text}
                  </span>
                  <span style={{ fontSize: 12, color: S.faint }}>
                    {new Date(o.createdAt).toLocaleDateString('zh-TW')}
                  </span>
                </div>
                <p style={{ fontSize: 15, fontWeight: 600, color: S.ink, margin: '0 0 6px' }}>
                  {o.orderItems[0]?.productName ?? '—'}
                  {o.orderItems.length > 1 && (
                    <span style={{ color: S.faint, fontWeight: 400 }}> 等 {o.orderItems.length} 項</span>
                  )}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: S.faint }}>#{o.id.slice(-8).toUpperCase()}</span>
                  <span style={{ fontSize: 20, fontWeight: 800, color: C.primary, letterSpacing: '-0.02em' }}>
                    NT${o.totalPaid.toLocaleString()}
                  </span>
                </div>
              </div>
              <ChevronRight />
            </button>
          )
        })}
      </div>
    </div>
  )
}
