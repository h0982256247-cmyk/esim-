'use client'

import { useState } from 'react'
import { BeeLogoSVG } from '@/components/liff/LiffIllustrations'
import { IconMyEsim, IconGuide, IconDataPlan, IconDevices } from './HomeIcons'
import FilterDropdown from './FilterDropdown'
import type { HomePageProps } from './types'

const QUICK_ACTIONS = [
  { key: 'orders',  label: '我的 eSIM', Icon: IconMyEsim,   bg: '#EFF6FF', color: '#2563eb' },
  { key: 'guide',   label: '安裝教學',  Icon: IconGuide,    bg: '#F0FDF4', color: '#16a34a' },
  { key: 'data',    label: '流量指南',  Icon: IconDataPlan, bg: '#FFF7ED', color: '#ea580c' },
  { key: 'devices', label: '支援裝置',  Icon: IconDevices,  bg: '#F5F3FF', color: '#7c3aed' },
]

const DAY_OPTIONS  = ['3天','5天','7天','10天','15天']
const DATA_OPTIONS = ['1GB','3GB','5GB','不限流量']

const CARD_GRADIENTS = [
  ['#667eea','#764ba2'],['#f093fb','#f5576c'],['#4facfe','#00f2fe'],
  ['#43e97b','#38f9d7'],['#fa709a','#fee140'],['#a18cd1','#fbc2eb'],
]
function getGradient(code: string) {
  let h = 0; for (const ch of code) h = (h * 31 + ch.charCodeAt(0)) & 0xffffffff
  const [a, b] = CARD_GRADIENTS[Math.abs(h) % CARD_GRADIENTS.length]
  return `linear-gradient(135deg,${a},${b})`
}

export default function ClassicHome({ tenant, slug, countries, colors: C, onSelectCountry, onNavigate, onSearch }: HomePageProps) {
  const [query, setQuery]     = useState('')
  const [selDays, setSelDays] = useState<string | null>(null)
  const [selData, setSelData] = useState<string | null>(null)
  const brandName = tenant?.brandName ?? 'eSIM'

  const filtered = query.trim()
    ? countries.filter(c => c.countryNameZh.includes(query) || c.countryNameEn.toLowerCase().includes(query.toLowerCase()))
    : []
  const hot = countries.slice(0, 6)

  function handleSearch() {
    const p = new URLSearchParams()
    if (query.trim()) p.set('q', query.trim())
    if (selDays) p.set('days', selDays.replace('天',''))
    if (selData) p.set('data', selData)
    onSearch(p.toString() ? `?${p}` : '')
  }

  return (
    <div style={{ background: '#FAF9F6', minHeight: '100vh', paddingBottom: 88, width: '100%', overflowX: 'hidden' }}>

      {/* Header */}
      <div style={{ background: '#fff', padding: '16px 20px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(0,0,0,0.06)', position: 'sticky', top: 0, zIndex: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 12, overflow: 'hidden', background: C.light, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {tenant?.logoUrl ? <img src={tenant.logoUrl} alt={brandName} style={{ width: 38, height: 38, objectFit: 'cover' }} /> : <BeeLogoSVG size={24} />}
          </div>
          <span style={{ fontSize: 17, fontWeight: 800, color: '#1a1a1a', letterSpacing: '-0.01em' }}>{brandName}</span>
        </div>
        <button onClick={() => onNavigate('orders')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>
          </svg>
        </button>
      </div>

      {/* 搜尋區 */}
      <div style={{ padding: '16px 16px 0' }}>
        {/* 搜尋列 + 按鈕 */}
        <div style={{ display: 'flex', gap: 8, width: '100%', boxSizing: 'border-box' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
            <div style={{
              background: '#fff', borderRadius: 14, border: '1.5px solid rgba(0,0,0,0.08)',
              display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
            }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.2" strokeLinecap="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                type="text" placeholder="搜尋目的地，例如：日本"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                style={{ flex: 1, border: 'none', outline: 'none', background: 'none', fontSize: 16, color: '#1a1a1a', padding: '13px 0', minWidth: 0 }}
              />
              {query && (
                <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#9ca3af', flexShrink: 0, display: 'flex' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              )}
            </div>

            {/* 搜尋下拉 */}
            {filtered.length > 0 && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 30,
                background: '#fff', borderRadius: 14, border: '1px solid rgba(0,0,0,0.08)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.1)', overflow: 'hidden', animation: 'dropIn 0.15s ease',
              }}>
                {filtered.map((c, i) => (
                  <button key={c.countryCode} onClick={() => { setQuery(''); onSelectCountry(c.countryCode) }}
                    style={{ width: '100%', background: 'none', border: 'none', borderBottom: i < filtered.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none', padding: '12px 16px', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 22 }}>{c.countryFlag ?? '🌍'}</span>
                    <div style={{ flex: 1 }}><p style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', margin: 0 }}>{c.countryNameZh}</p><p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>{c.countryNameEn}</p></div>
                    {c.minPrice && <span style={{ fontSize: 13, fontWeight: 700, color: C.primary }}>NT${c.minPrice}起</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 搜尋按鈕 */}
          <button onClick={handleSearch}
            style={{
              background: C.primary, border: 'none', borderRadius: 14, flexShrink: 0,
              padding: '0 16px', cursor: 'pointer', color: '#fff', fontWeight: 700, fontSize: 14,
              boxShadow: `0 4px 14px ${C.primary}50`,
              display: 'flex', alignItems: 'center', gap: 5, height: 48,
            }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            搜尋
          </button>
        </div>

        {/* 篩選下拉 */}
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <FilterDropdown label="天數" options={DAY_OPTIONS} value={selDays} onChange={setSelDays} primary={C.primary} />
          <FilterDropdown label="流量" options={DATA_OPTIONS} value={selData} onChange={setSelData} primary={C.primary} />
        </div>
      </div>

      {/* 快速功能 */}
      <div style={{ padding: '20px 16px 0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
          {QUICK_ACTIONS.map(({ key, label, Icon, bg, color }, i) => (
            <button key={key} onClick={() => onNavigate(key)}
              style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.06)', padding: '14px 4px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, cursor: 'pointer', boxShadow: '0 1px 6px rgba(0,0,0,0.04)', animation: `fadeUp 0.4s ${i * 0.05}s ease both` }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon color={color} size={22} />
              </div>
              <span style={{ fontSize: 11, color: '#374151', fontWeight: 600, textAlign: 'center', lineHeight: 1.3 }}>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 熱門目的地 */}
      <div style={{ padding: '24px 16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: '#1a1a1a', letterSpacing: '-0.01em' }}>熱門目的地</span>
          <button onClick={() => onNavigate('products')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: C.primary, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 2 }}>
            查看全部 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
        {hot.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#9ca3af', padding: '32px 0', fontSize: 14 }}>暫無商品</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {hot.map((c, i) => (
              <button key={c.countryCode} onClick={() => onSelectCountry(c.countryCode)}
                style={{ background: getGradient(c.countryCode), borderRadius: 18, border: 'none', cursor: 'pointer', padding: '18px 16px', textAlign: 'left', minHeight: 110, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative', overflow: 'hidden', animation: `fadeUp 0.4s ${0.1 + i * 0.06}s ease both`, boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }}>
                {i < 2 && <div style={{ position: 'absolute', top: 10, right: 10, background: '#ef4444', color: '#fff', fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', padding: '2px 6px', borderRadius: 6 }}>HOT</div>}
                <span style={{ fontSize: 36, lineHeight: 1, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}>{c.countryFlag ?? '🌍'}</span>
                <div>
                  <p style={{ fontSize: 16, fontWeight: 800, color: '#fff', margin: '0 0 2px', textShadow: '0 1px 4px rgba(0,0,0,0.25)' }}>{c.countryNameZh}</p>
                  {c.minPrice && <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', margin: 0, fontWeight: 600 }}>NT$ {c.minPrice} 起</p>}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        @keyframes dropIn { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
    </div>
  )
}
