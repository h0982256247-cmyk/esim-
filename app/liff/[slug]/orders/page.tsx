'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useLiff } from '@/components/liff/LiffProvider'
import { useLiffBase } from '@/hooks/useLiffBase'
import { useTenantColors } from '@/components/liff/TenantContext'
import { useCachedData } from '@/hooks/useCachedData'
import PageSkeleton from '@/components/liff/PageSkeleton'
import { EmptyOrdersIllustration, CouponIllustration } from '@/components/liff/LiffIllustrations'

// ─── Types ─────────────────────────────────────────────────────

type Order = {
  id: string
  orderNumber: string | null
  status: string
  totalPaid: number
  createdAt: string
  userId: string
  currentOwnerId: string
  bundleId: string | null
  failureReason: string | null
  cancelReason: string | null
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

type Coupon = {
  id: string
  type: string
  level: 'A' | 'B' | 'C'
  discount: number
  isOfficial: boolean
  expiresAt: string | null
  usedAt: string | null
  createdAt: string
}

// ─── Constants ────────────────────────────────────────────────

const S = {
  white: '#ffffff', ink: '#1a1a1a', muted: '#4b5563', faint: '#94a3b8',
  line: 'rgba(0,0,0,0.07)',
} as const

const COUPON_TYPE_LABEL: Record<string, string> = {
  OFFICIAL_WELCOME: '歡迎券',
  GROUP_JOIN:       '入群券',
  GROUP_REPURCHASE: '回購券',
  GROUP_OWNER:      '社群主專屬',
  GROUP_ACTIVITY:   '活動券',
}

// ─── State 分類 ────────────────────────────────────────────────

// 'awaitingPayment' 與 'preparingEsim' 把舊的 'processing' 拆開，UI 才能
// 給使用者更清楚的進度（等付款 vs 等啟動碼），不會看到一堆「處理中」混在一起。
type EsimState = 'using' | 'installable' | 'redeeming' | 'pending' | 'awaitingPayment' | 'preparingEsim' | 'history'

function classifyOrder(o: Order): EsimState {
  if (['REFUNDED', 'CANCELLED', 'FAILED'].includes(o.status)) return 'history'
  if (o.activatedAt) return 'using'
  if (o.esimQrcode) return 'installable'
  if (o.redeemedAt) return 'redeeming'
  if (o.esimRcode && o.status === 'COMPLETED') return 'pending'
  // PROCESSING = 付款 webhook 還沒回來；之外（PAID / ESIM_PENDING / COMPLETED-未發 rcode）
  // 都已經付完款，正等供應商開卡。
  if (o.status === 'PROCESSING') return 'awaitingPayment'
  return 'preparingEsim'
}

function giftBadge(o: Order): { text: string; bg: string; color: string } | null {
  const g = o.gift
  if (!g || g.cancelledAt) return null
  if (o.currentOwnerId !== o.userId && g.claimedAt && g.fromUser) {
    return { text: `📩 由 ${g.fromUser.displayName} 轉贈`, bg: '#ede9fe', color: '#6d28d9' }
  }
  if (g.claimedAt) return null
  if (new Date(g.expiresAt) > new Date()) {
    return { text: '📤 等待領取', bg: '#ffedd5', color: '#c2410c' }
  }
  return null
}

// 剩餘天數（給 hero 卡片用）
function daysLeft(o: Order): number | null {
  // 後端目前沒回 activationEnd 給列表頁，先用 createdAt 估
  return null
}

// ─── Page ──────────────────────────────────────────────────────

export default function OrdersPage() {
  const router = useRouter()
  const base = useLiffBase()
  const C = useTenantColors()
  const { liff } = useLiff()
  const searchParams = useSearchParams()
  const bundleIdParam = searchParams.get('bundleId')

  const [actioning, setActioning] = useState<string | null>(null)   // 哪個 order 正在處理
  const [showHistory, setShowHistory] = useState(false)

  const { data, loading, refresh } = useCachedData('orders', async () => {
    const [o, c] = await Promise.all([
      fetch('/api/orders').then(r => r.json()),
      fetch('/api/coupons').then(r => r.json()),
    ])
    return { orders: (o.orders ?? []) as Order[], coupons: (c.coupons ?? []) as Coupon[] }
  })
  const orders = data?.orders ?? []
  const coupons = data?.coupons ?? []

  // 分桶
  const buckets = useMemo(() => {
    const using:           Order[] = []
    const installable:     Order[] = []
    const redeeming:       Order[] = []
    const pending:         Order[] = []
    const awaitingPayment: Order[] = []
    const preparingEsim:   Order[] = []
    const history:         Order[] = []
    for (const o of orders) {
      const s = classifyOrder(o)
      switch (s) {
        case 'using':           using.push(o); break
        case 'installable':     installable.push(o); break
        case 'redeeming':       redeeming.push(o); break
        case 'pending':         pending.push(o); break
        case 'awaitingPayment': awaitingPayment.push(o); break
        case 'preparingEsim':   preparingEsim.push(o); break
        case 'history':         history.push(o); break
      }
    }
    return { using, installable, redeeming, pending, awaitingPayment, preparingEsim, history }
  }, [orders])

  // 一鍵取消所有卡在等待付款的訂單（特別處理使用者在 LINE Pay 取消後留下的殭屍訂單）
  const handleCancelStuck = async () => {
    if (actioning) return
    if (!window.confirm(`確定要取消這 ${buckets.awaitingPayment.length} 筆等待付款的訂單？\n\n若您剛在 LINE Pay 或銀行頁取消了付款，可一鍵清掉。`)) return
    setActioning('bulk_cancel')
    await Promise.all(
      buckets.awaitingPayment.map(o => fetch(`/api/orders/${o.id}/cancel`, { method: 'POST' }).catch(() => null))
    )
    setActioning(null)
    await refresh()
  }

  const now = new Date()
  const couponsAvailable = coupons.filter(c => !c.usedAt && (!c.expiresAt || new Date(c.expiresAt) > now))
  const couponsHistory   = coupons.filter(c =>  c.usedAt || (c.expiresAt && new Date(c.expiresAt) <= now))

  // 從結帳頁帶 ?bundleId=… 進來時，依該 bundle 的狀態做兩件事：
  //   1. 自動切到正確的 tab（全失敗 → 歷史；其他 → 預設）
  //   2. 全失敗顯示頂部紅色 banner + 重新下單 CTA
  const bundleOrders = useMemo(
    () => bundleIdParam ? orders.filter(o => o.bundleId === bundleIdParam) : [],
    [orders, bundleIdParam],
  )
  const bundleAllFailed = bundleOrders.length > 0 && bundleOrders.every(
    o => ['FAILED', 'CANCELLED', 'REFUNDED'].includes(o.status),
  )
  const bundleFirstFailureReason = bundleOrders.find(o => o.failureReason)?.failureReason ?? null

  useEffect(() => {
    // bundle 全失敗 → 自動展開「歷史」tab，使用者一進來就看到失敗的訂單而不必再點一下
    if (bundleAllFailed) setShowHistory(true)
  }, [bundleAllFailed])

  // ─── Handlers ────────────────────────────────────────────────

  const handleRedeem = async (o: Order) => {
    const ok = window.confirm('按下後將立即生成 QR 碼，僅可用於一張裝置且無法再轉贈。\n\n確定要安裝嗎？')
    if (!ok) return

    setActioning(o.id)
    const r = await fetch(`/api/orders/${o.id}/redeem`, { method: 'POST' }).then(x => x.json())
    setActioning(null)
    if (r.error) {
      alert(`兌換失敗：${r.error}`)
      return
    }
    // 兌換觸發成功 → 導去詳情頁等 QR
    router.push(`${base}/orders/${o.id}`)
  }

  const handleShare = async (o: Order) => {
    if (!liff?.isLoggedIn()) { alert('請先登入 LINE'); return }
    if (!liff.isApiAvailable('shareTargetPicker')) {
      alert('您的 LINE 版本不支援分享功能')
      return
    }
    if (!window.confirm('分享後此 eSIM 將由對方使用，您將無法自行啟用。\n\n確定要分享嗎？')) return

    setActioning(o.id)
    try {
      const r = await fetch(`/api/orders/${o.id}/gift`, { method: 'POST' }).then(x => x.json())
      if (!r.ok) { alert(`分享失敗：${r.error}`); setActioning(null); return }

      const giftPath = `${base}/gift/${r.token}`
      const fullUrl = `${window.location.origin}${giftPath}`
      let giftLink: string = fullUrl
      try { giftLink = await liff.permanentLink.createUrlBy(fullUrl) } catch {}

      const productName = o.orderItems[0]?.productName ?? 'eSIM'
      const flex = {
        type: 'flex' as const,
        altText: `你收到一張 eSIM：${productName}`,
        contents: {
          type: 'bubble' as const,
          body: {
            type: 'box' as const, layout: 'vertical' as const, spacing: 'md',
            contents: [
              { type: 'text' as const, text: '🎁 你收到一張 eSIM', weight: 'bold' as const, size: 'lg' as const, color: '#1a1a1a' },
              { type: 'text' as const, text: productName, size: 'md' as const, weight: 'bold' as const, wrap: true, color: C.primary },
              { type: 'text' as const, text: '點下方按鈕完成領取，即可開始使用', size: 'sm' as const, color: '#475569', wrap: true },
              { type: 'separator' as const, margin: 'md' as const },
              { type: 'text' as const, text: '⚠ 連結 7 天內有效，請盡快領取', size: 'xs' as const, color: '#94a3b8', wrap: true },
            ],
          },
          footer: {
            type: 'box' as const, layout: 'vertical' as const, spacing: 'sm',
            contents: [
              { type: 'button' as const, style: 'primary' as const, color: C.primary,
                action: { type: 'uri' as const, label: '查看並接受 eSIM', uri: giftLink } },
            ],
          },
        },
      }

      await liff.shareTargetPicker([flex])
      await refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : '分享失敗')
    }
    setActioning(null)
  }

  // ─── Render ──────────────────────────────────────────────────

  if (loading) return <PageSkeleton rows={4} />

  const hasAnything = orders.length > 0 || coupons.length > 0

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: '24px 16px 96px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: S.ink, margin: '0 0 20px', letterSpacing: '-0.02em' }}>
        我的 eSIM
      </h1>

      {/* Bundle 結帳後若整組失敗 → 頂部紅 banner + 重新下單 CTA。
          使用者從 LINE Pay 取消／3DS 失敗回來不必再點「歷史」找訂單。 */}
      {bundleAllFailed && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 16, padding: '18px 20px', marginBottom: 20 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#b91c1c', margin: '0 0 6px' }}>
            付款未完成
          </p>
          <p style={{ fontSize: 13, color: '#dc2626', margin: '0 0 14px', lineHeight: 1.6 }}>
            {bundleFirstFailureReason ?? '本次結帳的訂單未完成付款，請重新下單再試一次。'}
          </p>
          <button
            onClick={() => router.push(`${base}/products`)}
            style={{
              width: '100%',
              padding: '12px 0',
              border: 'none',
              borderRadius: 12,
              background: C.primary,
              color: C.onPrimary,
              fontSize: 15,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            重新下單
          </button>
        </div>
      )}

      {!hasAnything && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '48px 0' }}>
          <EmptyOrdersIllustration size={80} />
          <p style={{ fontSize: 14, color: S.faint }}>目前沒有訂單與優惠券</p>
          <button onClick={() => router.push(`${base}/products`)}
            style={{ marginTop: 8, background: C.primary, color: C.onPrimary, border: 'none', borderRadius: 100, padding: '11px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            去商城選方案
          </button>
        </div>
      )}

      {/* ─── 正在使用（hero） ─── */}
      {buckets.using.length > 0 && (
        <SectionHeader title="正在使用" count={buckets.using.length} primary />
      )}
      {buckets.using.map(o => (
        <HeroCard key={o.id} order={o} base={base} primary={C.primary} onClick={() => router.push(`${base}/orders/${o.id}`)} />
      ))}

      {/* ─── 可安裝（已生 QR 等用戶掃）─── */}
      {buckets.installable.length > 0 && (
        <SectionHeader title="可安裝" count={buckets.installable.length} />
      )}
      {buckets.installable.map(o => (
        <InstallableCard key={o.id} order={o} primary={C.primary} onClick={() => router.push(`${base}/orders/${o.id}`)} />
      ))}

      {/* ─── 待啟用（有 rcode、未按我要安裝）— 兩顆按鈕 ─── */}
      {buckets.pending.length > 0 && (
        <SectionHeader title="待啟用" count={buckets.pending.length} />
      )}
      {buckets.pending.map(o => (
        <PendingCard
          key={o.id}
          order={o}
          primary={C.primary}
          onPrimary={C.onPrimary}
          actioning={actioning === o.id}
          onRedeem={() => handleRedeem(o)}
          onShare={() => handleShare(o)}
          onClick={() => router.push(`${base}/orders/${o.id}`)}
        />
      ))}

      {/* ─── 等待付款（PROCESSING：銀行 webhook 沒回 / 使用者剛在 LINE Pay 取消）─── */}
      {buckets.awaitingPayment.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <SectionHeader title="等待付款" count={buckets.awaitingPayment.length} />
            <button
              onClick={handleCancelStuck}
              disabled={!!actioning}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                fontSize: 12, color: '#b45309', fontWeight: 700,
                textDecoration: 'underline', padding: '0 0 4px',
              }}
            >
              {actioning === 'bulk_cancel' ? '取消中…' : '全部取消'}
            </button>
          </div>
          {buckets.awaitingPayment.map(o => (
            <ProcessingCard key={o.id} order={o} stage="awaiting" onClick={() => router.push(`${base}/orders/${o.id}`)} />
          ))}
        </>
      )}

      {/* ─── 準備 eSIM 中（已付款，等供應商開卡）─── */}
      {(buckets.preparingEsim.length + buckets.redeeming.length) > 0 && (
        <SectionHeader title="準備 eSIM 中" count={buckets.preparingEsim.length + buckets.redeeming.length} />
      )}
      {buckets.preparingEsim.map(o => (
        <ProcessingCard key={o.id} order={o} stage="ordered" onClick={() => router.push(`${base}/orders/${o.id}`)} />
      ))}
      {buckets.redeeming.map(o => (
        <ProcessingCard key={o.id} order={o} stage="redeeming" onClick={() => router.push(`${base}/orders/${o.id}`)} />
      ))}

      {/* ─── 可用優惠券 ─── */}
      {couponsAvailable.length > 0 && (
        <>
          <SectionHeader title="可用優惠券" count={couponsAvailable.length} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {couponsAvailable.slice(0, 5).map(c => <CouponRow key={c.id} coupon={c} primary={C.primary} />)}
            {couponsAvailable.length > 5 && (
              <p style={{ textAlign: 'center', fontSize: 12, color: S.faint, padding: 8 }}>還有 {couponsAvailable.length - 5} 張…</p>
            )}
          </div>
        </>
      )}

      {/* ─── 歷史紀錄（預設收合）─── */}
      {(buckets.history.length + couponsHistory.length) > 0 && (
        <>
          <button onClick={() => setShowHistory(s => !s)}
            style={{ width: '100%', marginTop: 24, background: 'transparent', border: 'none', padding: '10px', fontSize: 13, color: S.muted, cursor: 'pointer', textDecoration: 'underline' }}>
            {showHistory ? '收起歷史紀錄' : `查看歷史紀錄（${buckets.history.length + couponsHistory.length}）`}
          </button>
          {showHistory && (
            <div style={{ marginTop: 8, opacity: 0.7, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {buckets.history.map(o => (
                <CompactRow key={o.id} order={o} primary={C.primary} onClick={() => router.push(`${base}/orders/${o.id}`)} />
              ))}
              {couponsHistory.map(c => <CouponRow key={c.id} coupon={c} primary={C.primary} inactive />)}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────────

function SectionHeader({ title, count, primary }: { title: string; count: number; primary?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '20px 4px 10px' }}>
      <h2 style={{ fontSize: primary ? 14 : 12, fontWeight: 700, color: primary ? S.ink : S.muted, margin: 0, letterSpacing: primary ? 0 : '0.04em' }}>
        {title}
      </h2>
      <span style={{ fontSize: 11, color: S.faint }}>{count}</span>
    </div>
  )
}

function HeroCard({ order, primary, onClick }: { order: Order; base: string; primary: string; onClick: () => void }) {
  const productName = order.orderItems[0]?.productName ?? 'eSIM'
  const gift = giftBadge(order)
  return (
    <button onClick={onClick}
      style={{
        width: '100%', textAlign: 'left', cursor: 'pointer',
        background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
        border: '1px solid #6ee7b7', borderRadius: 18, padding: '20px',
        boxShadow: '0 2px 8px rgba(16,185,129,0.15)',
      }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#047857', background: '#fff', padding: '4px 10px', borderRadius: 100 }}>
          ✅ 使用中
        </span>
        {gift && (
          <span style={{ fontSize: 11, fontWeight: 700, background: gift.bg, color: gift.color, padding: '3px 10px', borderRadius: 100 }}>
            {gift.text}
          </span>
        )}
      </div>
      <p style={{ fontSize: 18, fontWeight: 800, color: '#064e3b', margin: '0 0 6px', letterSpacing: '-0.02em' }}>
        {productName}
      </p>
      <p style={{ fontSize: 12, color: '#065f46', margin: 0 }}>
        點擊查看 QR、流量用量與安裝資訊
      </p>
      <p style={{ fontSize: 11, color: primary, fontWeight: 600, margin: '8px 0 0' }}>
        查看詳情 →
      </p>
    </button>
  )
}

function InstallableCard({ order, primary, onClick }: { order: Order; primary: string; onClick: () => void }) {
  const productName = order.orderItems[0]?.productName ?? 'eSIM'
  return (
    <button onClick={onClick}
      style={{
        width: '100%', textAlign: 'left', cursor: 'pointer',
        background: '#eff6ff', border: '1px solid #93c5fd', borderRadius: 16,
        padding: '14px 16px', marginBottom: 8,
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: 11, fontWeight: 700, background: '#dbeafe', color: '#1d4ed8', padding: '3px 8px', borderRadius: 100 }}>
            📱 QR 已就緒
          </span>
          <p style={{ fontSize: 15, fontWeight: 700, color: S.ink, margin: '8px 0 2px' }}>{productName}</p>
          <p style={{ fontSize: 11, color: S.muted, margin: 0 }}>點擊查看 QR 與一鍵安裝</p>
        </div>
        <span style={{ fontSize: 14, color: primary, fontWeight: 700 }}>→</span>
      </div>
    </button>
  )
}

function PendingCard({ order, primary, onPrimary, actioning, onRedeem, onShare, onClick }: {
  order: Order; primary: string; onPrimary: string; actioning: boolean;
  onRedeem: () => void; onShare: () => void; onClick: () => void
}) {
  const productName = order.orderItems[0]?.productName ?? 'eSIM'
  const gift = giftBadge(order)
  const hasPendingGift = order.gift && !order.gift.claimedAt && !order.gift.cancelledAt && new Date(order.gift.expiresAt) > new Date()

  return (
    <div style={{ background: S.white, border: `1px solid ${S.line}`, borderRadius: 16, padding: '16px', marginBottom: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
      <button onClick={onClick} style={{ background: 'none', border: 'none', padding: 0, width: '100%', textAlign: 'left', cursor: 'pointer' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, background: '#e0e7ff', color: '#4338ca', padding: '3px 10px', borderRadius: 100 }}>
            📦 未使用
          </span>
          {gift && (
            <span style={{ fontSize: 11, fontWeight: 700, background: gift.bg, color: gift.color, padding: '3px 10px', borderRadius: 100 }}>
              {gift.text}
            </span>
          )}
        </div>
        <p style={{ fontSize: 16, fontWeight: 700, color: S.ink, margin: '0 0 4px' }}>{productName}</p>
        <p style={{ fontSize: 11, color: S.faint, margin: '0 0 12px' }}>
          {new Date(order.createdAt).toLocaleDateString('zh-TW')} · NT${order.totalPaid.toLocaleString()}
        </p>
      </button>

      {!hasPendingGift ? (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8 }}>
          <button onClick={onRedeem} disabled={actioning}
            style={{ background: primary, color: onPrimary, border: 'none', borderRadius: 100, padding: '11px', fontSize: 14, fontWeight: 700, cursor: actioning ? 'wait' : 'pointer', opacity: actioning ? 0.6 : 1 }}>
            {actioning ? '處理中…' : '📲 我要安裝'}
          </button>
          <button onClick={onShare} disabled={actioning}
            style={{ background: S.white, color: primary, border: `1.5px solid ${primary}`, borderRadius: 100, padding: '11px', fontSize: 13, fontWeight: 700, cursor: actioning ? 'wait' : 'pointer', opacity: actioning ? 0.6 : 1 }}>
            📤 轉贈
          </button>
        </div>
      ) : (
        <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10, padding: '8px 10px' }}>
          <p style={{ fontSize: 11, color: '#9a3412', margin: 0, lineHeight: 1.5 }}>
            已分享給朋友，等待領取。如要自己安裝，請進入訂單詳情取消分享。
          </p>
        </div>
      )}
    </div>
  )
}

function ProcessingCard({ order, stage, onClick }: { order: Order; stage: 'awaiting' | 'ordered' | 'redeeming'; onClick: () => void }) {
  const productName = order.orderItems[0]?.productName ?? 'eSIM'
  const text = stage === 'awaiting'  ? '⏳ 等待付款確認中…'
             : stage === 'ordered'   ? '⏳ 正在準備 eSIM，請稍候…'
             :                          '⏳ 正在生成 QR 碼，請稍候…'
  return (
    <button onClick={onClick}
      style={{ width: '100%', textAlign: 'left', cursor: 'pointer', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 16, padding: '14px 16px', marginBottom: 8 }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: '#a16207', margin: '0 0 4px' }}>{text}</p>
      <p style={{ fontSize: 14, fontWeight: 600, color: S.ink, margin: 0 }}>{productName}</p>
    </button>
  )
}

function CompactRow({ order, primary, onClick }: { order: Order; primary: string; onClick: () => void }) {
  const productName = order.orderItems[0]?.productName ?? 'eSIM'
  const isRefunded = order.status === 'REFUNDED'
  const isCancelled = order.status === 'CANCELLED'
  return (
    <button onClick={onClick}
      style={{ width: '100%', textAlign: 'left', cursor: 'pointer', background: S.white, border: `1px solid ${S.line}`, borderRadius: 12, padding: '12px 14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontSize: 11, fontWeight: 600, color: isRefunded ? '#b91c1c' : isCancelled ? S.faint : '#15803d' }}>
            {isRefunded ? '已退款' : isCancelled ? '已取消' : '已結束'}
          </span>
          <p style={{ fontSize: 13, fontWeight: 600, color: S.ink, margin: '2px 0 0' }}>{productName}</p>
        </div>
        <span style={{ fontSize: 11, color: S.faint }}>{new Date(order.createdAt).toLocaleDateString('zh-TW')}</span>
      </div>
    </button>
  )
}

function CouponRow({ coupon, primary, inactive }: { coupon: Coupon; primary: string; inactive?: boolean }) {
  const pct = Math.round((1 - coupon.discount) * 100)
  const fold = Math.round(coupon.discount * 10)
  const now = new Date()
  const expired = !coupon.usedAt && coupon.expiresAt && new Date(coupon.expiresAt) <= now
  const isInactive = inactive || coupon.usedAt || expired
  return (
    <div style={{
      background: S.white, border: `1px solid ${S.line}`, borderRadius: 12,
      padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      opacity: isInactive ? 0.5 : 1,
    }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: S.ink, margin: 0 }}>{COUPON_TYPE_LABEL[coupon.type] ?? coupon.type}</p>
          {coupon.isOfficial && (
            <span style={{ fontSize: 9, fontWeight: 700, background: '#dcfce7', color: '#15803d', padding: '1px 6px', borderRadius: 100 }}>官方</span>
          )}
        </div>
        <p style={{ fontSize: 11, color: S.faint, margin: '2px 0 0' }}>
          {coupon.usedAt ? `已於 ${new Date(coupon.usedAt).toLocaleDateString('zh-TW')} 使用`
            : expired ? '已過期'
            : coupon.expiresAt ? `${new Date(coupon.expiresAt).toLocaleDateString('zh-TW')} 到期` : '無使用期限'}
        </p>
      </div>
      <div style={{ textAlign: 'right' }}>
        <p style={{ fontSize: 16, fontWeight: 800, color: isInactive ? S.faint : primary, margin: 0, letterSpacing: '-0.02em' }}>
          {pct}% OFF
        </p>
        <p style={{ fontSize: 10, color: S.faint, margin: 0 }}>{fold} 折</p>
      </div>
    </div>
  )
}
