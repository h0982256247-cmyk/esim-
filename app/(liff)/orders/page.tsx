'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { EmptyOrdersIllustration } from '@/components/liff/LiffIllustrations'
import { useTenantColors } from '@/components/liff/TenantContext'

type Order = {
  id: string
  orderNumber: string | null
  status: string
  totalPaid: number
  createdAt: string
  userId: string
  currentOwnerId: string
  esimRcode: string | null
  esimQrcode: string | null
  redeemedAt: string | null
  activatedAt: string | null
  orderItems: { productName: string; qty: number; unitPrice: number }[]
  gift: {
    claimedAt: string | null
    cancelledAt: string | null
    expiresAt: string
    fromUser: { displayName: string } | null
    toUser: { displayName: string } | null
    recipientName: string | null
  } | null
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
  CANCELLED:    { text: '已取消',      bg: '#f1f5f9', color: '#94a3b8' },
}

function ChevronRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={S.faint} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

// 主要 eSIM 階段 chip（顯示在最前）
function esimChip(o: Order): { text: string; bg: string; color: string } | null {
  if (o.activatedAt)                              return { text: '✅ 已激活',  bg: '#dcfce7', color: '#15803d' }
  if (o.redeemedAt && o.esimQrcode)               return { text: '📱 可安裝',  bg: '#dbeafe', color: '#1d4ed8' }
  if (o.redeemedAt && !o.esimQrcode)              return { text: '⏳ 兌換中',  bg: '#fef3c7', color: '#a16207' }
  if (o.esimRcode && !o.redeemedAt && o.status === 'COMPLETED')
                                                  return { text: '📦 未使用',  bg: '#e0e7ff', color: '#4338ca' }
  if (o.status === 'PAID' || o.status === 'ESIM_PENDING')
                                                  return { text: '⏳ 處理中',  bg: '#fef3c7', color: '#a16207' }
  return null
}

// 轉贈 chip（次要，gift 狀態用）
function giftChip(o: Order): { text: string; bg: string; color: string } | null {
  const g = o.gift
  if (!g) return null
  if (g.cancelledAt) return null
  if (o.currentOwnerId !== o.userId && g.claimedAt && g.fromUser) {
    return { text: `📩 ${g.fromUser.displayName} 轉贈`, bg: '#ede9fe', color: '#6d28d9' }
  }
  if (g.claimedAt) {
    const who = g.toUser?.displayName ?? g.recipientName ?? '對方'
    return { text: `📤 已給 ${who}`, bg: '#f1f5f9', color: '#475569' }
  }
  if (new Date(g.expiresAt) > new Date()) {
    return { text: '📤 等待領取', bg: '#ffedd5', color: '#c2410c' }
  }
  return null
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
          // 主 chip 優先用 eSIM 階段；非正常路徑 fallback 到 Order.status
          const e = esimChip(o)
          const sFallback = STATUS_META[o.status] ?? { text: o.status, bg: '#f1f5f9', color: '#475569' }
          const mainChip = e ?? sFallback
          const g = giftChip(o)
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 6, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700,
                      background: mainChip.bg, color: mainChip.color,
                      padding: '3px 10px', borderRadius: 100,
                    }}>
                      {mainChip.text}
                    </span>
                    {g && (
                      <span style={{
                        fontSize: 11, fontWeight: 700,
                        background: g.bg, color: g.color,
                        padding: '3px 10px', borderRadius: 100,
                      }}>
                        {g.text}
                      </span>
                    )}
                  </div>
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
                  <span style={{ fontSize: 12, color: S.faint }}>{o.orderNumber ?? `#${o.id.slice(-8).toUpperCase()}`}</span>
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
