'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useLiff } from '@/components/liff/LiffProvider'
import { useLiffBase } from '@/hooks/useLiffBase'
import { useTenantColors } from '@/components/liff/TenantContext'
import { useCachedData } from '@/hooks/useCachedData'
import PageSkeleton from '@/components/liff/PageSkeleton'
import { EmptyOrdersIllustration } from '@/components/liff/LiffIllustrations'
import {
  deriveEsimStatus, groupOf, daysLeftOf,
  TAB_ORDER, TAB_LABEL, type OrdersTab,
} from '@/lib/esimStatus'

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
  esimIccid: string | null
  activationStart: string | null
  activationEnd: string | null
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

type EsimUsage = {
  iccid: string
  totalData: number
  usedData: number
  remainingData: number
  unit: string
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

// ─── Helpers ──────────────────────────────────────────────────

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

function formatData(mb: number, unit: string): string {
  if (unit === 'GB' || mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`
  return `${mb.toLocaleString()} MB`
}

function expiryLabel(o: Order): string | null {
  const dl = daysLeftOf(o.activationEnd)
  if (dl === null) return null
  const end = o.activationEnd ? new Date(o.activationEnd).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' }) : ''
  if (dl < 0)  return `已於 ${end} 到期`
  if (dl === 0) return `今天到期`
  return `剩 ${dl} 天 · ${end} 到期`
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
  const [tab, setTab] = useState<OrdersTab | null>(null)            // null = 用 defaultTab
  const [usageMap, setUsageMap] = useState<Record<string, EsimUsage | null>>({})
  const usageFetchedRef = useRef<Set<string>>(new Set())

  const { data, loading, refresh } = useCachedData('orders', async () => {
    const [o, c] = await Promise.all([
      fetch('/api/orders').then(r => r.json()),
      fetch('/api/coupons').then(r => r.json()),
    ])
    return { orders: (o.orders ?? []) as Order[], coupons: (c.coupons ?? []) as Coupon[] }
  })
  const orders = useMemo(() => data?.orders ?? [], [data])
  const coupons = data?.coupons ?? []

  // 分桶：依「使用者視角 phase」歸到三個分頁 + 一個處理中橫幅
  const buckets = useMemo(() => {
    const active: Order[] = []          // 使用中（含即將到期）
    const install: Order[] = []         // 待安裝（可安裝 / 待啟用 / 產生 QR 中）
    const history: Order[] = []         // 已結束 / 取消 / 退款 / 失敗
    const awaitingPayment: Order[] = [] // 處理中橫幅：等付款確認
    const preparing: Order[] = []       // 處理中橫幅：已付款開卡中
    for (const o of orders) {
      const phase = deriveEsimStatus(o).phase
      switch (groupOf(phase)) {
        case 'active':  active.push(o); break
        case 'install': install.push(o); break
        case 'history': history.push(o); break
        case 'processing':
          if (phase === 'awaitingPayment') awaitingPayment.push(o)
          else preparing.push(o)
          break
      }
    }
    return { active, install, history, awaitingPayment, preparing }
  }, [orders])

  const counts: Record<OrdersTab, number> = {
    active: buckets.active.length,
    install: buckets.install.length,
    history: buckets.history.length,
  }

  // 從結帳頁帶 ?bundleId=… 進來、且該 bundle 全失敗 → 預設切到「歷史」並顯示紅 banner
  const bundleOrders = useMemo(
    () => bundleIdParam ? orders.filter(o => o.bundleId === bundleIdParam) : [],
    [orders, bundleIdParam],
  )
  const bundleAllFailed = bundleOrders.length > 0 && bundleOrders.every(
    o => ['FAILED', 'CANCELLED', 'REFUNDED'].includes(o.status),
  )
  const bundleFirstFailureReason = bundleOrders.find(o => o.failureReason)?.failureReason ?? null

  // 預設分頁：bundle 全失敗→歷史；否則第一個非空（使用中→待安裝→歷史）
  const defaultTab: OrdersTab =
    bundleAllFailed ? 'history'
      : counts.active > 0 ? 'active'
      : counts.install > 0 ? 'install'
      : counts.history > 0 ? 'history'
      : 'active'
  const activeTab = tab ?? defaultTab

  // 「使用中」分頁開啟時，best-effort 抓一次流量（只打有 ICCID 的，且每張只打一次）
  useEffect(() => {
    if (activeTab !== 'active') return
    const toFetch = buckets.active.filter(o => o.esimIccid && !usageFetchedRef.current.has(o.id))
    if (toFetch.length === 0) return
    let cancelled = false
    toFetch.forEach(o => usageFetchedRef.current.add(o.id))
    ;(async () => {
      for (const o of toFetch) {
        try {
          const d = await fetch(`/api/orders/${o.id}/usage`).then(r => r.json())
          if (!cancelled) setUsageMap(m => ({ ...m, [o.id]: d.usage ?? null }))
        } catch {
          if (!cancelled) setUsageMap(m => ({ ...m, [o.id]: null }))
        }
      }
    })()
    return () => { cancelled = true }
  }, [activeTab, buckets.active])

  const now = new Date()
  const couponsAvailable = coupons.filter(c => !c.usedAt && (!c.expiresAt || new Date(c.expiresAt) > now))
  const couponsHistory   = coupons.filter(c =>  c.usedAt || (c.expiresAt && new Date(c.expiresAt) <= now))

  // ─── Handlers ────────────────────────────────────────────────

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
  const processingCount = buckets.awaitingPayment.length + buckets.preparing.length

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: '24px 16px 96px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: S.ink, margin: '0 0 16px', letterSpacing: '-0.02em' }}>
        我的 eSIM
      </h1>

      {/* Bundle 結帳後若整組失敗 → 頂部紅 banner + 重新下單 CTA。 */}
      {bundleAllFailed && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 16, padding: '18px 20px', marginBottom: 16 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#b91c1c', margin: '0 0 6px' }}>付款未完成</p>
          <p style={{ fontSize: 13, color: '#dc2626', margin: '0 0 14px', lineHeight: 1.6 }}>
            {bundleFirstFailureReason ?? '本次結帳的訂單未完成付款，請重新下單再試一次。'}
          </p>
          <button onClick={() => router.push(`${base}/products`)}
            style={{ width: '100%', padding: '12px 0', border: 'none', borderRadius: 12, background: C.primary, color: C.onPrimary, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
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

      {hasAnything && (
        <>
          {/* ── 處理中橫幅（任何分頁都看得到，瞬時狀態）── */}
          {processingCount > 0 && (
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 14, padding: '12px 14px', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: buckets.awaitingPayment.length || buckets.preparing.length ? 8 : 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid #fde68a', borderTopColor: '#d97706', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#a16207' }}>{processingCount} 筆訂單處理中</span>
                </div>
                {buckets.awaitingPayment.length > 0 && (
                  <button onClick={handleCancelStuck} disabled={!!actioning}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 12, color: '#b45309', fontWeight: 700, textDecoration: 'underline', padding: 0 }}>
                    {actioning === 'bulk_cancel' ? '取消中…' : '全部取消'}
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {buckets.awaitingPayment.map(o => (
                  <ProcessingRow key={o.id} order={o} stage="awaiting" onClick={() => router.push(`${base}/orders/${o.id}`)} />
                ))}
                {buckets.preparing.map(o => (
                  <ProcessingRow key={o.id} order={o} stage="ordered" onClick={() => router.push(`${base}/orders/${o.id}`)} />
                ))}
              </div>
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          )}

          {/* ── 分頁籤（sticky）── */}
          <div style={{ position: 'sticky', top: 0, zIndex: 10, background: '#fff', paddingTop: 4, paddingBottom: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, background: '#f1f5f9', borderRadius: 12, padding: 4 }}>
              {TAB_ORDER.map(t => {
                const sel = activeTab === t
                return (
                  <button key={t} onClick={() => setTab(t)}
                    style={{
                      border: 'none', borderRadius: 9, padding: '9px 4px', cursor: 'pointer',
                      background: sel ? '#fff' : 'transparent',
                      boxShadow: sel ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
                      color: sel ? S.ink : S.muted, fontWeight: sel ? 700 : 600, fontSize: 13,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                      transition: 'background 0.15s',
                    }}>
                    {TAB_LABEL[t]}
                    {counts[t] > 0 && (
                      <span style={{
                        fontSize: 11, fontWeight: 700, minWidth: 17, textAlign: 'center',
                        color: sel ? C.onPrimary : S.faint,
                        background: sel ? C.primary : '#e2e8f0',
                        borderRadius: 100, padding: '0 5px', lineHeight: '16px',
                      }}>
                        {counts[t]}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── 分頁內容 ── */}
          {activeTab === 'active' && (
            buckets.active.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {buckets.active.map(o => (
                  <ActiveCard key={o.id} order={o} usage={usageMap[o.id]} primary={C.primary}
                    onClick={() => router.push(`${base}/orders/${o.id}`)} />
                ))}
              </div>
            ) : <TabEmpty text="目前沒有使用中的 eSIM" />
          )}

          {activeTab === 'install' && (
            buckets.install.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {buckets.install.map(o => {
                  const phase = deriveEsimStatus(o).phase
                  if (phase === 'readyToInstall') return (
                    <PendingCard key={o.id} order={o} primary={C.primary} onPrimary={C.onPrimary}
                      actioning={actioning === o.id}
                      onRedeem={() => handleRedeem(o)} onShare={() => handleShare(o)}
                      onClick={() => router.push(`${base}/orders/${o.id}`)} />
                  )
                  if (phase === 'installable') return (
                    <InstallableCard key={o.id} order={o} primary={C.primary}
                      onClick={() => router.push(`${base}/orders/${o.id}`)} />
                  )
                  return (
                    <ProcessingRow key={o.id} order={o} stage="redeeming" boxed
                      onClick={() => router.push(`${base}/orders/${o.id}`)} />
                  )
                })}
              </div>
            ) : <TabEmpty text="沒有待安裝的 eSIM" />
          )}

          {activeTab === 'history' && (
            (buckets.history.length + couponsHistory.length) > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {buckets.history.map(o => (
                  <CompactRow key={o.id} order={o} onClick={() => router.push(`${base}/orders/${o.id}`)} />
                ))}
                {couponsHistory.map(c => <CouponRow key={c.id} coupon={c} primary={C.primary} inactive />)}
              </div>
            ) : <TabEmpty text="沒有歷史紀錄" />
          )}

          {/* ── 可用優惠券（非歷史分頁才顯示）── */}
          {activeTab !== 'history' && couponsAvailable.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '0 4px 10px' }}>
                <h2 style={{ fontSize: 12, fontWeight: 700, color: S.muted, margin: 0, letterSpacing: '0.04em' }}>可用優惠券</h2>
                <span style={{ fontSize: 11, color: S.faint }}>{couponsAvailable.length}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {couponsAvailable.slice(0, 5).map(c => <CouponRow key={c.id} coupon={c} primary={C.primary} />)}
                {couponsAvailable.length > 5 && (
                  <p style={{ textAlign: 'center', fontSize: 12, color: S.faint, padding: 8 }}>還有 {couponsAvailable.length - 5} 張…</p>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────────

function TabEmpty({ text }: { text: string }) {
  return (
    <p style={{ textAlign: 'center', fontSize: 13, color: S.faint, padding: '40px 0' }}>{text}</p>
  )
}

function UsageBar({ used, total }: { used: number; total: number }) {
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0
  const color = pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : '#22c55e'
  return (
    <div style={{ background: 'rgba(255,255,255,0.7)', borderRadius: 100, height: 7, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 100, transition: 'width 0.6s ease' }} />
    </div>
  )
}

function ActiveCard({ order, usage, primary, onClick }: {
  order: Order; usage: EsimUsage | null | undefined; primary: string; onClick: () => void
}) {
  const productName = order.orderItems[0]?.productName ?? 'eSIM'
  const view = deriveEsimStatus(order)
  const expiring = view.phase === 'expiringSoon'
  const gift = giftBadge(order)
  const expiry = expiryLabel(order)

  const accent  = expiring ? '#c2410c' : '#047857'
  const deepInk = expiring ? '#7c2d12' : '#064e3b'
  const subInk  = expiring ? '#9a3412' : '#065f46'
  const bg      = expiring ? 'linear-gradient(135deg,#fff7ed 0%,#ffedd5 100%)' : 'linear-gradient(135deg,#ecfdf5 0%,#d1fae5 100%)'
  const border  = expiring ? '#fdba74' : '#6ee7b7'
  const shadow  = expiring ? '0 2px 8px rgba(234,88,12,0.15)' : '0 2px 8px rgba(16,185,129,0.15)'

  return (
    <button onClick={onClick}
      style={{ width: '100%', textAlign: 'left', cursor: 'pointer', background: bg, border: `1px solid ${border}`, borderRadius: 18, padding: '18px 20px', boxShadow: shadow }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: accent, background: '#fff', padding: '4px 10px', borderRadius: 100 }}>
          {view.icon} {view.label}
        </span>
        {gift && (
          <span style={{ fontSize: 11, fontWeight: 700, background: gift.bg, color: gift.color, padding: '3px 10px', borderRadius: 100 }}>
            {gift.text}
          </span>
        )}
      </div>

      <p style={{ fontSize: 18, fontWeight: 800, color: deepInk, margin: '0 0 4px', letterSpacing: '-0.02em' }}>
        {productName}
      </p>
      {expiry && (
        <p style={{ fontSize: 13, fontWeight: 600, color: expiring ? accent : subInk, margin: '0 0 12px' }}>
          {expiry}
        </p>
      )}

      {/* 流量（best-effort，抓到才顯示） */}
      {usage ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
          <UsageBar used={usage.usedData} total={usage.totalData} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: subInk }}>
            <span>剩 <strong>{formatData(usage.remainingData, usage.unit)}</strong></span>
            <span style={{ opacity: 0.7 }}>共 {formatData(usage.totalData, usage.unit)}</span>
          </div>
        </div>
      ) : usage === undefined && order.esimIccid ? (
        <div style={{ height: 7, background: 'rgba(255,255,255,0.5)', borderRadius: 100, marginTop: 4 }} />
      ) : null}

      <p style={{ fontSize: 11, color: primary, fontWeight: 700, margin: '12px 0 0' }}>
        查看 QR、流量與安裝資訊 →
      </p>
    </button>
  )
}

function InstallableCard({ order, primary, onClick }: { order: Order; primary: string; onClick: () => void }) {
  const productName = order.orderItems[0]?.productName ?? 'eSIM'
  return (
    <button onClick={onClick}
      style={{ width: '100%', textAlign: 'left', cursor: 'pointer', background: '#eff6ff', border: '1px solid #93c5fd', borderRadius: 16, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
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
    <div style={{ background: S.white, border: `1.5px solid ${primary}`, borderRadius: 16, padding: '16px', boxShadow: `0 2px 10px ${primary}22` }}>
      <button onClick={onClick} style={{ background: 'none', border: 'none', padding: 0, width: '100%', textAlign: 'left', cursor: 'pointer' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, background: primary, color: onPrimary, padding: '3px 10px', borderRadius: 100 }}>
            📦 可以安裝
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

// 處理中／產生 QR 中的精簡列。boxed=true 時自帶卡片外框（用於分頁內），
// 否則為橫幅內的緊湊列。
function ProcessingRow({ order, stage, boxed, onClick }: {
  order: Order; stage: 'awaiting' | 'ordered' | 'redeeming'; boxed?: boolean; onClick: () => void
}) {
  const productName = order.orderItems[0]?.productName ?? 'eSIM'
  const text = stage === 'awaiting' ? '等待付款確認中…'
             : stage === 'ordered'  ? '正在準備 eSIM，請稍候…'
             :                         '正在生成 QR 碼，請稍候…'
  return (
    <button onClick={onClick}
      style={{
        width: '100%', textAlign: 'left', cursor: 'pointer',
        background: boxed ? '#fffbeb' : 'transparent',
        border: boxed ? '1px solid #fde68a' : 'none',
        borderRadius: boxed ? 16 : 0, padding: boxed ? '14px 16px' : '2px 0',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
      }}>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: boxed ? 14 : 13, fontWeight: 600, color: S.ink, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{productName}</p>
        <p style={{ fontSize: 11, color: '#a16207', margin: '2px 0 0' }}>⏳ {text}</p>
      </div>
      <span style={{ fontSize: 13, color: S.faint, flexShrink: 0 }}>→</span>
    </button>
  )
}

function CompactRow({ order, onClick }: { order: Order; onClick: () => void }) {
  const productName = order.orderItems[0]?.productName ?? 'eSIM'
  const view = deriveEsimStatus(order)
  const color = view.phase === 'failed' ? '#b91c1c' : view.phase === 'ended' ? '#15803d' : S.faint
  return (
    <button onClick={onClick}
      style={{ width: '100%', textAlign: 'left', cursor: 'pointer', background: S.white, border: `1px solid ${S.line}`, borderRadius: 12, padding: '12px 14px', opacity: 0.85 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontSize: 11, fontWeight: 600, color }}>{view.label}</span>
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
  const isInactive = inactive || !!coupon.usedAt || !!expired
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
