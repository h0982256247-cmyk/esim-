'use client'

import { useState } from 'react'
import { BeeLogoSVG } from '@/components/liff/LiffIllustrations'
import { IconMyEsim, IconGuide, IconDataPlan, IconDevices } from './HomeIcons'
import FilterDropdown from './FilterDropdown'
import { CountryFlag } from '@/components/common/CountryFlag'
import type { HomePageProps } from './types'

const QUICK_ACTIONS = [
  { key: 'orders',  label: '我的 eSIM', Icon: IconMyEsim,   bg: '#C4B5FD', color: '#5B21B6' },
  { key: 'guide',   label: '安裝教學',  Icon: IconGuide,    bg: '#86EFAC', color: '#166534' },
  { key: 'data',    label: '流量指南',  Icon: IconDataPlan, bg: '#FDE68A', color: '#92400E' },
  { key: 'devices', label: '支援裝置',  Icon: IconDevices,  bg: '#93C5FD', color: '#1E40AF' },
]

const DAY_OPTIONS  = ['3天','5天','7天','10天','15天']
const DATA_OPTIONS = ['1GB','3GB','5GB','不限流量']

const CARD_PALETTE = [
  { bg: '#FBBF24', text: '#78350F' },
  { bg: '#93C5FD', text: '#1E3A8A' },
  { bg: '#C4B5FD', text: '#4C1D95' },
  { bg: '#86EFAC', text: '#14532D' },
  { bg: '#F9A8D4', text: '#831843' },
  { bg: '#FCA5A5', text: '#7F1D1D' },
]
function getCard(code: string) {
  let h = 0; for (const ch of code) h = (h * 31 + ch.charCodeAt(0)) & 0xffffffff
  return CARD_PALETTE[Math.abs(h) % CARD_PALETTE.length]
}

export default function ClassicHome({
  tenant, countries, colors: C, onSelectCountry, onNavigate, onSearch,
}: HomePageProps) {
  const [query, setQuery]       = useState('')
  const [selDays, setSelDays]   = useState<string | null>(null)
  const [selData, setSelData]   = useState<string | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const brandName = tenant?.brandName ?? 'eSIM'

  const filtered = query.trim()
    ? countries.filter(c =>
        c.countryNameZh.includes(query) ||
        c.countryNameEn.toLowerCase().includes(query.toLowerCase()))
    : []
  const hot = countries.slice(0, 6)

  function handleSearch() {
    const p = new URLSearchParams()
    if (query.trim()) p.set('q', query.trim())
    if (selDays) p.set('days', selDays.replace('天', ''))
    if (selData) p.set('data', selData)
    onSearch(p.toString() ? `?${p}` : '')
  }

  return (
    <div style={{
      background: '#EEEEF8', minHeight: '100vh', paddingBottom: 100,
      width: '100%', overflowX: 'hidden',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif',
    }}>

      {/* ── Header ── */}
      <div style={{ padding: '18px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 46, height: 46, borderRadius: '50%', overflow: 'hidden',
            background: '#fff', flexShrink: 0,
            boxShadow: '3px 4px 0 rgba(0,0,0,0.10)',
            border: '2px solid rgba(0,0,0,0.06)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {tenant?.logoUrl
              ? <img src={tenant.logoUrl} alt={brandName} style={{ width: 46, height: 46, objectFit: 'cover' }} />
              : <BeeLogoSVG size={26} />}
          </div>
          <div>
            <p style={{ fontSize: 12, color: '#9ca3af', margin: 0, fontWeight: 500 }}>歡迎使用</p>
            <p style={{ fontSize: 19, fontWeight: 900, color: '#1a1a1a', margin: 0, letterSpacing: '-0.025em' }}>{brandName}</p>
          </div>
        </div>
        {/* Search icon toggles the search panel */}
        <button
          onClick={() => setSearchOpen(o => !o)}
          style={{
            width: 44, height: 44, borderRadius: '50%', background: '#fff',
            border: searchOpen ? `2px solid ${C.primary}` : '2px solid rgba(0,0,0,0.06)',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: searchOpen ? `3px 4px 0 ${C.primary}40` : '3px 4px 0 rgba(0,0,0,0.10)',
            transition: 'box-shadow 0.2s, border 0.2s',
          }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke={searchOpen ? C.primary : '#374151'} strokeWidth="2.2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        </button>
      </div>

      {/* ── Search Panel (collapsible) ── */}
      {searchOpen && (
        <div style={{ padding: '14px 20px 0', animation: 'dropIn 0.18s ease' }}>
          <div style={{ display: 'flex', gap: 8, width: '100%', boxSizing: 'border-box' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
              <div style={{
                background: '#fff', borderRadius: 18, display: 'flex', alignItems: 'center',
                gap: 10, padding: '0 14px',
                boxShadow: '4px 4px 0 rgba(0,0,0,0.08)',
                border: '2px solid rgba(0,0,0,0.07)',
              }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.2" strokeLinecap="round">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input
                  type="text" placeholder="搜尋目的地，例如：日本"
                  autoFocus value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  style={{ flex: 1, border: 'none', outline: 'none', background: 'none', fontSize: 16, color: '#1a1a1a', padding: '13px 0', minWidth: 0 }}
                />
                {query && (
                  <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', flexShrink: 0, display: 'flex' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                )}
              </div>

              {/* 搜尋下拉結果 */}
              {filtered.length > 0 && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 30,
                  background: '#fff', borderRadius: 18, overflow: 'hidden',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.12)', animation: 'dropIn 0.15s ease',
                }}>
                  {filtered.map((c, i) => (
                    <button key={c.countryCode}
                      onClick={() => { setQuery(''); setSearchOpen(false); onSelectCountry(c.countryCode) }}
                      style={{
                        width: '100%', background: 'none', border: 'none',
                        borderBottom: i < filtered.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none',
                        padding: '12px 16px', cursor: 'pointer', textAlign: 'left',
                        display: 'flex', alignItems: 'center', gap: 12,
                      }}>
                      <CountryFlag code={c.countryCode} fallbackEmoji={c.countryFlag} size={28} />
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a', margin: 0 }}>{c.countryNameZh}</p>
                        <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>{c.countryNameEn}</p>
                      </div>
                      {c.minPrice && <span style={{ fontSize: 13, fontWeight: 800, color: C.primary }}>NT${c.minPrice}起</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button onClick={handleSearch} style={{
              background: C.primary,
              border: '2px solid rgba(0,0,0,0.10)',
              borderRadius: 18, flexShrink: 0,
              padding: '0 18px', cursor: 'pointer', color: '#fff', fontWeight: 700, fontSize: 14,
              height: 48, boxShadow: '4px 4px 0 rgba(0,0,0,0.12)',
              display: 'flex', alignItems: 'center', gap: 5,
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
      )}

      {/* ── Hero Banner ── */}
      <div style={{ padding: '18px 20px 0' }}>
        <div style={{
          borderRadius: 28, padding: '28px 22px',
          position: 'relative', overflow: 'hidden', minHeight: 180,
          backgroundImage: 'url(https://images.unsplash.com/photo-1490806843957-31f4c9a91c65?w=800&q=80)',
          backgroundSize: 'cover', backgroundPosition: 'center 40%',
          boxShadow: '6px 8px 0 rgba(109,40,217,0.22)',
          border: '2px solid rgba(109,40,217,0.18)',
        }}>
          {/* 紫色漸層遮罩 */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(120deg, rgba(109,40,217,0.82) 0%, rgba(124,58,237,0.68) 50%, rgba(139,92,246,0.30) 100%)',
            borderRadius: 26,
          }}/>

          <div style={{ position: 'relative', zIndex: 1, maxWidth: '65%' }}>
            <div style={{
              display: 'inline-block', background: 'rgba(255,255,255,0.2)',
              borderRadius: 8, padding: '3px 10px', marginBottom: 10,
              border: '1px solid rgba(255,255,255,0.3)',
            }}>
              <p style={{ fontSize: 10, fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '0.14em', textTransform: 'uppercase' }}>出發前必備</p>
            </div>
            <h2 style={{ fontSize: 27, fontWeight: 900, color: '#fff', margin: '0 0 8px', lineHeight: 1.1, letterSpacing: '-0.025em', textShadow: '0 2px 8px rgba(0,0,0,0.25)' }}>探索世界，<br/>隨時在線</h2>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', margin: '0 0 18px', lineHeight: 1.4, textShadow: '0 1px 4px rgba(0,0,0,0.2)' }}>最便宜的旅遊 eSIM 方案</p>
            <button onClick={() => onNavigate('products')} style={{
              background: '#fff', border: '2px solid rgba(255,255,255,0.8)', borderRadius: 22,
              padding: '9px 20px', cursor: 'pointer',
              fontSize: 13, fontWeight: 800, color: '#7C3AED',
              boxShadow: '3px 4px 0 rgba(0,0,0,0.15)',
            }}>
              立即選購 →
            </button>
          </div>
        </div>
      </div>

      {/* ── 快速功能 ── */}
      <div style={{ padding: '22px 20px 0' }}>
        <p style={{ fontSize: 19, fontWeight: 900, color: '#1a1a1a', margin: '0 0 14px', letterSpacing: '-0.025em' }}>快速功能</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
          {QUICK_ACTIONS.map(({ key, label, Icon, bg, color }, i) => (
            <button key={key} onClick={() => onNavigate(key)}
              style={{
                background: bg, borderRadius: 22,
                border: '2px solid rgba(0,0,0,0.07)',
                padding: '16px 4px 14px', display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 9, cursor: 'pointer',
                animation: `fadeUp 0.4s ${i * 0.05}s ease both`,
                boxShadow: '4px 5px 0 rgba(0,0,0,0.10)',
              }}>
              <div style={{
                width: 46, height: 46, borderRadius: 15,
                background: 'rgba(255,255,255,0.65)',
                border: '1.5px solid rgba(255,255,255,0.9)',
                boxShadow: '2px 2px 0 rgba(0,0,0,0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon color={color} size={23} />
              </div>
              <span style={{ fontSize: 11, color, fontWeight: 800, textAlign: 'center', lineHeight: 1.3 }}>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── 熱門目的地 ── */}
      <div style={{ padding: '24px 20px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <p style={{ fontSize: 19, fontWeight: 900, color: '#1a1a1a', margin: 0, letterSpacing: '-0.025em' }}>熱門目的地</p>
          <button onClick={() => onNavigate('products')} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 13, color: '#7C3AED', fontWeight: 700,
            display: 'flex', alignItems: 'center', gap: 2,
          }}>
            查看全部
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        </div>

        {hot.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#9ca3af', padding: '32px 0', fontSize: 14 }}>暫無商品</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {hot.map((c, i) => {
              const { bg, text } = getCard(c.countryCode)
              return (
                <button key={c.countryCode} onClick={() => onSelectCountry(c.countryCode)}
                  style={{
                    background: bg, borderRadius: 26,
                    border: '2px solid rgba(0,0,0,0.07)',
                    cursor: 'pointer',
                    padding: '18px 16px', textAlign: 'left', minHeight: 150,
                    display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                    position: 'relative', overflow: 'hidden',
                    animation: `fadeUp 0.4s ${0.1 + i * 0.06}s ease both`,
                    boxShadow: '5px 6px 0 rgba(0,0,0,0.10)',
                  }}>
                  {/* HOT badge */}
                  {i < 2 && (
                    <div style={{
                      position: 'absolute', top: 12, right: 12,
                      background: 'rgba(0,0,0,0.12)', borderRadius: 8,
                      fontSize: 9, fontWeight: 900, letterSpacing: '0.08em',
                      color: text, padding: '3px 7px',
                    }}>HOT</div>
                  )}

                  {/* 國旗 */}
                  <div style={{ filter: 'drop-shadow(0 3px 8px rgba(0,0,0,0.12))' }}>
                    <CountryFlag code={c.countryCode} fallbackEmoji={c.countryFlag} size={52} />
                  </div>

                  {/* 國名 + 價格 */}
                  <div style={{ marginTop: 10 }}>
                    <p style={{ fontSize: 18, fontWeight: 900, color: text, margin: '0 0 2px', letterSpacing: '-0.02em' }}>{c.countryNameZh}</p>
                    <p style={{ fontSize: 11, color: `${text}99`, margin: '0 0 8px', fontWeight: 500 }}>{c.countryNameEn}</p>
                    {c.minPrice && (
                      <div style={{
                        background: 'rgba(255,255,255,0.45)', borderRadius: 10,
                        padding: '4px 10px', display: 'inline-flex', alignItems: 'center',
                      }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: text }}>NT${c.minPrice} 起</span>
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes dropIn { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
    </div>
  )
}
