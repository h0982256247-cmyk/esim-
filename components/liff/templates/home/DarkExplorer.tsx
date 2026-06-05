'use client'

import { useState } from 'react'
import { BeeLogoSVG } from '@/components/liff/LiffIllustrations'
import type { HomePageProps } from './types'

const QUICK_ACTIONS = [
  { key: 'orders',  label: '我的 eSIM', icon: '📱' },
  { key: 'guide',   label: '安裝教學',  icon: '📖' },
  { key: 'data',    label: '流量指南',  icon: '⚡' },
  { key: 'devices', label: '支援裝置',  icon: '⚙️' },
]

export default function DarkExplorer({
  tenant, slug, countries, colors: C,
  onSelectCountry, onNavigate,
}: HomePageProps) {
  const [query, setQuery] = useState('')
  const brandName = tenant?.brandName ?? 'eSIM'
  const primary = tenant?.primaryColor ?? '#6366f1'

  const filtered = query.trim()
    ? countries.filter(c =>
        c.countryNameZh.includes(query) ||
        c.countryNameEn.toLowerCase().includes(query.toLowerCase())
      )
    : []

  const hot = countries.slice(0, 8)

  return (
    <div style={{ background: '#0a0a0f', minHeight: '100vh', paddingBottom: 88 }}>

      {/* 背景光暈 */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', top: '-20%', left: '-10%',
          width: '70vw', height: '70vw', borderRadius: '50%',
          background: `radial-gradient(circle, ${primary}30 0%, transparent 70%)`,
          animation: 'orb1 10s ease-in-out infinite alternate',
        }}/>
        <div style={{
          position: 'absolute', bottom: '10%', right: '-15%',
          width: '50vw', height: '50vw', borderRadius: '50%',
          background: 'radial-gradient(circle, #06b6d425 0%, transparent 70%)',
          animation: 'orb2 12s ease-in-out infinite alternate',
        }}/>
      </div>

      {/* ── Header ── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 20,
        padding: '16px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'rgba(10,10,15,0.85)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
          }}>
            {tenant?.logoUrl
              ? <img src={tenant.logoUrl} alt={brandName} style={{ width: 36, height: 36, objectFit: 'cover' }} />
              : <BeeLogoSVG size={22} />
            }
          </div>
          <span style={{ fontSize: 16, fontWeight: 800, color: '#fff', letterSpacing: '-0.01em' }}>{brandName}</span>
        </div>
        <button onClick={() => onNavigate('orders')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
            <line x1="3" y1="6" x2="21" y2="6"/>
            <path d="M16 10a4 4 0 0 1-8 0"/>
          </svg>
        </button>
      </div>

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* ── Hero ── */}
        <div style={{ padding: '28px 20px 0', textAlign: 'center', animation: 'fadeUp 0.6s ease both' }}>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: '0 0 8px', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
            Your Travel Partner
          </p>
          <h1 style={{ fontSize: 32, fontWeight: 900, color: '#fff', margin: '0 0 4px', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
            探索世界，
          </h1>
          <h1 style={{ fontSize: 32, fontWeight: 900, margin: '0 0 24px', letterSpacing: '-0.03em', lineHeight: 1.1,
            background: `linear-gradient(90deg, ${primary}, #06b6d4)`,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            隨時保持連線
          </h1>
        </div>

        {/* ── 搜尋欄 ── */}
        <div style={{ padding: '0 16px 24px', position: 'relative', animation: 'fadeUp 0.6s 0.1s ease both' }}>
          <div style={{
            background: 'rgba(255,255,255,0.07)',
            border: `1.5px solid rgba(255,255,255,0.12)`,
            borderRadius: 16,
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '13px 16px',
            backdropFilter: 'blur(10px)',
            boxShadow: `0 0 30px ${primary}20`,
          }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              placeholder="搜尋目的地..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              style={{
                flex: 1, border: 'none', outline: 'none', background: 'none',
                fontSize: 14, color: '#fff',
              }}
            />
            {query && (
              <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'rgba(255,255,255,0.4)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            )}
          </div>

          {filtered.length > 0 && (
            <div style={{
              position: 'absolute', left: 16, right: 16, top: '100%', zIndex: 30, marginTop: 6,
              background: '#1a1a2e', borderRadius: 14,
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
              overflow: 'hidden', animation: 'dropIn 0.15s ease',
            }}>
              {filtered.map((c, i) => (
                <button
                  key={c.countryCode}
                  onClick={() => { setQuery(''); onSelectCountry(c.countryCode) }}
                  style={{
                    width: '100%', background: 'none', border: 'none',
                    borderBottom: i < filtered.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                    padding: '12px 16px', cursor: 'pointer', textAlign: 'left',
                    display: 'flex', alignItems: 'center', gap: 12,
                  }}
                >
                  <span style={{ fontSize: 20 }}>{c.countryFlag ?? '🌍'}</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: '#fff', margin: 0 }}>{c.countryNameZh}</p>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: 0 }}>{c.countryNameEn}</p>
                  </div>
                  {c.minPrice && <span style={{ fontSize: 13, fontWeight: 700, color: primary }}>NT${c.minPrice}起</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── 快速功能 ── */}
        <div style={{ padding: '0 16px 24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
            {QUICK_ACTIONS.map((a, i) => (
              <button
                key={a.key}
                onClick={() => onNavigate(a.key)}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 14, padding: '14px 4px 12px',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                  cursor: 'pointer', backdropFilter: 'blur(8px)',
                  animation: `fadeUp 0.5s ${0.15 + i * 0.05}s ease both`,
                }}
              >
                <span style={{ fontSize: 22 }}>{a.icon}</span>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', fontWeight: 600, textAlign: 'center', lineHeight: 1.3 }}>
                  {a.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* ── 熱門目的地 ── */}
        <div style={{ padding: '0 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: '#fff', letterSpacing: '-0.01em' }}>🔥 熱門目的地</span>
            <button
              onClick={() => onNavigate('products')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: primary, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 2 }}
            >
              查看全部 <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>

          {/* 橫向捲動 */}
          <div style={{
            display: 'flex', gap: 10, overflowX: 'auto',
            scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch',
            marginRight: -16, paddingRight: 16,
            msOverflowStyle: 'none', scrollbarWidth: 'none',
          }}>
            {hot.map((c, i) => (
              <button
                key={c.countryCode}
                onClick={() => onSelectCountry(c.countryCode)}
                style={{
                  flexShrink: 0, width: 120, height: 150,
                  borderRadius: 18, border: 'none', cursor: 'pointer',
                  background: getDarkGrad(c.countryCode),
                  scrollSnapAlign: 'start',
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'flex-end',
                  padding: 14, position: 'relative', overflow: 'hidden',
                  animation: `fadeUp 0.5s ${0.2 + i * 0.04}s ease both`,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
                }}
              >
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.55))', pointerEvents: 'none' }}/>
                {c.countryFlag && (
                  <span style={{ position: 'absolute', top: 12, right: 12, fontSize: 28, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}>
                    {c.countryFlag}
                  </span>
                )}
                <div style={{ position: 'relative', zIndex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 800, color: '#fff', margin: '0 0 2px', textShadow: '0 1px 3px rgba(0,0,0,0.4)' }}>
                    {c.countryNameZh}
                  </p>
                  {c.minPrice && (
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', margin: 0, fontWeight: 600 }}>
                      NT${c.minPrice}起
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeUp  { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes dropIn  { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes orb1    { from{transform:translate(0,0) scale(1)} to{transform:translate(8%,6%) scale(1.15)} }
        @keyframes orb2    { from{transform:translate(0,0) scale(1)} to{transform:translate(-6%,-8%) scale(1.1)} }
      `}</style>
    </div>
  )
}

const DARK_GRADS = [
  ['#1a1a2e','#16213e'],['#0d1b2a','#1b4332'],['#1e1b4b','#312e81'],
  ['#1c1917','#44403c'],['#0f172a','#1e3a5f'],['#18181b','#3f3f46'],
  ['#14532d','#166534'],['#1e1b4b','#4c1d95'],
]
function getDarkGrad(code: string) {
  let h = 0
  for (const ch of code) h = (h * 31 + ch.charCodeAt(0)) & 0xffffffff
  const [a, b] = DARK_GRADS[Math.abs(h) % DARK_GRADS.length]
  return `linear-gradient(145deg,${a},${b})`
}
