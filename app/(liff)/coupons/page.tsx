'use client'

import { useEffect, useState } from 'react'
import { CouponIllustration } from '@/components/liff/LiffIllustrations'

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

const S = {
  white: '#ffffff',
  ink: '#0f172a',
  muted: '#64748b',
  faint: '#94a3b8',
  line: 'rgba(0,0,0,0.07)',
  accent: '#0284c7',
} as const

const TYPE_LABEL: Record<string, string> = {
  OFFICIAL_WELCOME: '歡迎券',
  GROUP_JOIN:       '入群券',
  GROUP_REPURCHASE: '回購券',
  GROUP_OWNER:      '社群主專屬',
  GROUP_ACTIVITY:   '活動券',
}

const LEVEL_META: Record<string, { bg: string; color: string; label: string }> = {
  A: { bg: '#fef2f2', color: '#b91c1c', label: 'A' },
  B: { bg: '#fff7ed', color: '#c2410c', label: 'B' },
  C: { bg: '#eff6ff', color: '#1d4ed8', label: 'C' },
}

function discountLabel(d: number) {
  const pct = Math.round((1 - d) * 100)
  return `${pct}% OFF`
}

function discountFold(d: number) {
  return `${Math.round(d * 10)} 折`
}

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'available' | 'used'>('available')

  useEffect(() => {
    fetch('/api/coupons')
      .then(r => r.json())
      .then(d => setCoupons(d.coupons ?? []))
      .finally(() => setLoading(false))
  }, [])

  const now = new Date()
  const available = coupons.filter(c => !c.usedAt && (!c.expiresAt || new Date(c.expiresAt) > now))
  const used = coupons.filter(c => c.usedAt || (c.expiresAt && new Date(c.expiresAt) <= now))
  const list = tab === 'available' ? available : used

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ width: 28, height: 28, border: '2.5px solid #e0f2fe', borderTopColor: S.accent, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', paddingBottom: 96 }}>
      <div style={{ padding: '24px 16px 0' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: S.ink, margin: '0 0 16px' }}>優惠券</h1>

        {/* Tab switcher */}
        <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 12, padding: 4, marginBottom: 16, gap: 4 }}>
          {(['available', 'used'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1, padding: '9px 0', borderRadius: 9,
                fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
                background: tab === t ? S.white : 'transparent',
                color: tab === t ? S.ink : S.faint,
                boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              {t === 'available' ? `可使用  ${available.length}` : `已使用 / 過期  ${used.length}`}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {list.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '48px 0' }}>
            <CouponIllustration size={80} />
            <p style={{ fontSize: 14, color: S.faint }}>
              {tab === 'available' ? '目前沒有可使用的優惠券' : '沒有使用紀錄'}
            </p>
          </div>
        )}

        {list.map(c => {
          const lv = LEVEL_META[c.level] ?? LEVEL_META.C
          const expired = !c.usedAt && c.expiresAt && new Date(c.expiresAt) <= now
          return (
            <div
              key={c.id}
              style={{
                background: S.white,
                borderRadius: 16,
                border: `1px solid ${S.line}`,
                overflow: 'hidden',
                opacity: c.usedAt || expired ? 0.5 : 1,
                display: 'flex',
              }}
            >
              {/* Left accent strip */}
              <div style={{
                width: 52,
                background: c.usedAt || expired ? '#f1f5f9' : lv.bg,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                borderRight: `1px dashed ${S.line}`,
                padding: '16px 0',
                flexShrink: 0,
              }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: c.usedAt || expired ? S.faint : lv.color }}>{lv.label}</span>
                <span style={{ fontSize: 9, color: c.usedAt || expired ? S.faint : lv.color, fontWeight: 600, letterSpacing: '0.05em' }}>LEVEL</span>
              </div>

              {/* Content */}
              <div style={{ flex: 1, padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: S.ink, margin: 0 }}>
                      {TYPE_LABEL[c.type] ?? c.type}
                    </p>
                    {c.isOfficial && (
                      <span style={{ fontSize: 10, fontWeight: 700, background: '#dcfce7', color: '#15803d', padding: '1px 6px', borderRadius: 100 }}>
                        官方
                      </span>
                    )}
                  </div>
                  {c.usedAt ? (
                    <p style={{ fontSize: 12, color: S.faint, margin: 0 }}>
                      已於 {new Date(c.usedAt).toLocaleDateString('zh-TW')} 使用
                    </p>
                  ) : c.expiresAt ? (
                    <p style={{ fontSize: 12, color: expired ? '#ef4444' : S.faint, margin: 0 }}>
                      {expired ? '已過期' : `有效至 ${new Date(c.expiresAt).toLocaleDateString('zh-TW')}`}
                    </p>
                  ) : (
                    <p style={{ fontSize: 12, color: S.faint, margin: 0 }}>無使用期限</p>
                  )}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <p style={{ fontSize: 20, fontWeight: 800, color: c.usedAt || expired ? S.faint : S.accent, margin: 0, letterSpacing: '-0.02em' }}>
                    {discountLabel(c.discount)}
                  </p>
                  <p style={{ fontSize: 11, color: S.faint, margin: 0 }}>{discountFold(c.discount)}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
