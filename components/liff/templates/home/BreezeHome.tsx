'use client'

import { useState } from 'react'
import { BeeLogoSVG } from '@/components/liff/LiffIllustrations'
import type { HomePageProps } from './types'

const QUICK_ACTIONS = [
  { key: 'orders',  label: '我的 eSIM', bg: '#E8F4FD', icon: '📱' },
  { key: 'guide',   label: '安裝教學',  bg: '#F0FDF4', icon: '📖' },
  { key: 'data',    label: '流量指南',  bg: '#FFF7ED', icon: '⚡' },
  { key: 'devices', label: '支援裝置',  bg: '#F5F3FF', icon: '⚙️' },
]

export default function BreezeHome({
  tenant, slug, countries, colors: C,
  onSelectCountry, onNavigate,
}: HomePageProps) {
  const [query, setQuery] = useState('')
  const brandName = tenant?.brandName ?? 'eSIM'

  const filtered = query.trim()
    ? countries.filter(c =>
        c.countryNameZh.includes(query) ||
        c.countryNameEn.toLowerCase().includes(query.toLowerCase())
      )
    : []

  const hot = countries.slice(0, 6)

  return (
    <div style={{ background: '#ffffff', minHeight: '100vh', paddingBottom: 88 }}>

      {/* ── Header ── */}
      <div style={{
        padding: '20px 20px 0',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%', overflow: 'hidden',
            background: C.light,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 0 0 2px ${C.border}`,
          }}>
            {tenant?.logoUrl
              ? <img src={tenant.logoUrl} alt={brandName} style={{ width: 40, height: 40, objectFit: 'cover' }} />
              : <BeeLogoSVG size={24} />
            }
          </div>
          <div>
            <p style={{ fontSize: 12, color: '#9ca3af', margin: 0, letterSpacing: '0.04em' }}>歡迎回來</p>
            <p style={{ fontSize: 16, fontWeight: 800, color: '#111', margin: 0, letterSpacing: '-0.01em' }}>{brandName}</p>
          </div>
        </div>
        <button
          onClick={() => onNavigate('orders')}
          style={{
            background: C.light, border: 'none', borderRadius: 12,
            width: 38, height: 38, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
            <line x1="3" y1="6" x2="21" y2="6"/>
            <path d="M16 10a4 4 0 0 1-8 0"/>
          </svg>
        </button>
      </div>

      {/* ── 搜尋欄 ── */}
      <div style={{ padding: '16px 16px 0', position: 'relative' }}>
        <div style={{
          background: '#F7F8FA',
          borderRadius: 18,
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '14px 16px',
        }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="你要去哪裡？"
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{
              flex: 1, border: 'none', outline: 'none', background: 'none',
              fontSize: 15, color: '#111',
            }}
          />
          {query && (
            <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
              <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </div>
            </button>
          )}
        </div>

        {filtered.length > 0 && (
          <div style={{
            position: 'absolute', left: 16, right: 16, top: '100%', zIndex: 30, marginTop: 6,
            background: '#fff', borderRadius: 16,
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            border: '1px solid rgba(0,0,0,0.06)',
            overflow: 'hidden', animation: 'dropIn 0.15s ease',
          }}>
            {filtered.map((c, i) => (
              <button
                key={c.countryCode}
                onClick={() => { setQuery(''); onSelectCountry(c.countryCode) }}
                style={{
                  width: '100%', background: 'none', border: 'none',
                  borderBottom: i < filtered.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none',
                  padding: '12px 16px', cursor: 'pointer', textAlign: 'left',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}
              >
                <span style={{ fontSize: 22 }}>{c.countryFlag ?? '🌍'}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#111', margin: 0 }}>{c.countryNameZh}</p>
                  <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>{c.countryNameEn}</p>
                </div>
                {c.minPrice && <span style={{ fontSize: 13, fontWeight: 700, color: C.primary }}>NT${c.minPrice}起</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── 快速功能 ── */}
      <div style={{ padding: '20px 16px 0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
          {QUICK_ACTIONS.map((a, i) => (
            <button
              key={a.key}
              onClick={() => onNavigate(a.key)}
              style={{
                background: a.bg, border: 'none',
                borderRadius: 18, padding: '14px 4px 12px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                cursor: 'pointer',
                animation: `popIn 0.4s ${i * 0.06}s cubic-bezier(0.34,1.56,0.64,1) both`,
              }}
            >
              <span style={{ fontSize: 24 }}>{a.icon}</span>
              <span style={{ fontSize: 10, color: '#374151', fontWeight: 700, textAlign: 'center', lineHeight: 1.3 }}>
                {a.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── 熱門目的地 ── */}
      <div style={{ padding: '24px 16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: '#111', letterSpacing: '-0.02em' }}>
            ✈️ 熱門目的地
          </span>
          <button
            onClick={() => onNavigate('products')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: C.primary, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 2 }}
          >
            查看全部 →
          </button>
        </div>

        {hot.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#9ca3af', padding: '32px 0', fontSize: 14 }}>暫無商品</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {hot.map((c, i) => (
              <button
                key={c.countryCode}
                onClick={() => onSelectCountry(c.countryCode)}
                style={{
                  width: '100%', textAlign: 'left', border: 'none',
                  background: '#F7F8FA', borderRadius: 16,
                  padding: '14px 16px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 14,
                  animation: `slideIn 0.4s ${0.05 + i * 0.04}s ease both`,
                }}
              >
                <div style={{
                  width: 48, height: 48, borderRadius: 14, flexShrink: 0,
                  background: getBreezeGrad(c.countryCode),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 24,
                }}>
                  {c.countryFlag ?? '🌍'}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 15, fontWeight: 700, color: '#111', margin: 0 }}>{c.countryNameZh}</p>
                  <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>{c.countryNameEn}</p>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  {c.minPrice ? (
                    <>
                      <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>起價</p>
                      <p style={{ fontSize: 16, fontWeight: 800, color: C.primary, margin: 0 }}>
                        NT${c.minPrice}
                      </p>
                    </>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes popIn    { from{opacity:0;transform:scale(0.8)} to{opacity:1;transform:scale(1)} }
        @keyframes slideIn  { from{opacity:0;transform:translateX(-10px)} to{opacity:1;transform:translateX(0)} }
        @keyframes dropIn   { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
    </div>
  )
}

const BREEZE_GRADS = ['#FFF7ED','#F0FDF4','#EFF6FF','#FDF4FF','#F0FDFA','#FFFBEB']
function getBreezeGrad(code: string) {
  let h = 0
  for (const ch of code) h = (h * 31 + ch.charCodeAt(0)) & 0xffffffff
  return BREEZE_GRADS[Math.abs(h) % BREEZE_GRADS.length]
}
