'use client'

import { calcBestPrice } from '@/lib/utils/coupon-combo'
import { CountryFlag } from '@/components/common/CountryFlag'
import DayPicker from '@/components/liff/DayPicker'
import type { ProductsTemplateProps } from './types'

const S = {
  ink: '#1a1a1a', muted: '#4b5563', faint: '#94a3b8',
  white: '#ffffff', line: 'rgba(0,0,0,0.07)',
} as const

// 每個國家固定一個漸層色組
const COUNTRY_GRADIENTS = [
  ['#667eea', '#764ba2'], ['#f093fb', '#f5576c'], ['#4facfe', '#00f2fe'],
  ['#43e97b', '#38f9d7'], ['#fa709a', '#fee140'], ['#a18cd1', '#fbc2eb'],
  ['#fccb90', '#d57eeb'], ['#96fbc4', '#f9f586'],
]

function getGradient(code: string) {
  let hash = 0
  for (const ch of code) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffffffff
  const [a, b] = COUNTRY_GRADIENTS[Math.abs(hash) % COUNTRY_GRADIENTS.length]
  return `linear-gradient(135deg, ${a} 0%, ${b} 100%)`
}

function BackArrow() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

export default function MagazineShop({
  countries, products, coupons, selectedCountry,
  colors: C, onSelectCountry, onSelectProduct, onBack,
  filter, cart,
}: ProductsTemplateProps) {
  if (!selectedCountry) {
    return (
      <div style={{ paddingBottom: 96 }}>
        {/* Header */}
        <div style={{ padding: '32px 20px 20px' }}>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: S.ink, letterSpacing: '-0.03em', margin: '0 0 4px' }}>
            去哪裡？
          </h1>
          <p style={{ fontSize: 14, color: S.faint, margin: 0 }}>選擇你的旅遊目的地</p>
        </div>

        {/* 橫向捲動大卡 */}
        <div style={{
          display: 'flex', gap: 14,
          overflowX: 'auto', padding: '0 20px 8px',
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
          msOverflowStyle: 'none', scrollbarWidth: 'none',
        }}>
          {countries.map(c => (
            <button
              key={c.countryCode}
              onClick={() => onSelectCountry(c.countryCode)}
              style={{
                flexShrink: 0, width: 160, height: 200,
                borderRadius: 20, border: 'none', cursor: 'pointer',
                background: getGradient(c.countryCode),
                scrollSnapAlign: 'start',
                display: 'flex', flexDirection: 'column',
                alignItems: 'flex-start', justifyContent: 'flex-end',
                padding: 18, boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
                position: 'relative', overflow: 'hidden',
              }}
            >
              <div style={{
                position: 'absolute', top: 16, right: 16,
                filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.25))',
              }}>
                <CountryFlag code={c.countryCode} fallbackEmoji={c.countryFlag} size={48} />
              </div>
              <div style={{ position: 'relative', zIndex: 1 }}>
                <p style={{ fontSize: 18, fontWeight: 800, color: '#fff', margin: '0 0 2px', textShadow: '0 1px 4px rgba(0,0,0,0.3)' }}>
                  {c.countryNameZh}
                </p>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', margin: 0, letterSpacing: '0.06em' }}>
                  {c.countryNameEn}
                </p>
              </div>
            </button>
          ))}
        </div>

        {/* 全部國家列表 */}
        {countries.length > 0 && (
          <div style={{ padding: '24px 20px 0' }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: S.faint, letterSpacing: '0.12em', margin: '0 0 12px' }}>ALL DESTINATIONS</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {countries.map(c => (
                <button
                  key={c.countryCode}
                  onClick={() => onSelectCountry(c.countryCode)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    background: 'none', border: 'none', borderRadius: 12,
                    padding: '12px 8px', cursor: 'pointer',
                    borderBottom: `1px solid ${S.line}`,
                    textAlign: 'left',
                  }}
                >
                  <span style={{ width: 32, display: 'inline-flex', justifyContent: 'center' }}>
                    <CountryFlag code={c.countryCode} fallbackEmoji={c.countryFlag} size={28} />
                  </span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 15, fontWeight: 600, color: S.ink, margin: 0 }}>{c.countryNameZh}</p>
                    <p style={{ fontSize: 12, color: S.faint, margin: 0 }}>{c.countryNameEn}</p>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={S.faint} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  const country = countries.find(c => c.countryCode === selectedCountry)
  const gradient = getGradient(selectedCountry)
  const showNoMatch = filter.dayFilter > 0 && filter.filteredCount === 0

  return (
    <div style={{ paddingBottom: 96 }}>
      {/* Hero banner */}
      <div style={{
        background: gradient,
        padding: '0 20px',
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 20px)',
        paddingBottom: 32,
        position: 'relative', overflow: 'hidden',
      }}>
        <button
          onClick={onBack}
          style={{
            background: 'rgba(255,255,255,0.2)', border: 'none',
            borderRadius: 10, padding: '8px 10px', cursor: 'pointer',
            color: '#fff', display: 'flex', alignItems: 'center', gap: 4,
            marginBottom: 20, fontSize: 13, fontWeight: 600,
          }}
        >
          <BackArrow />
          <span>返回</span>
        </button>

        {country && (
          <div style={{ marginBottom: 14, filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.3))' }}>
            <CountryFlag code={country.countryCode} fallbackEmoji={country.countryFlag} size={80} />
          </div>
        )}
        <h1 style={{ fontSize: 32, fontWeight: 900, color: '#fff', margin: '0 0 4px', letterSpacing: '-0.02em', textShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
          {country?.countryNameZh}
        </h1>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', margin: 0 }}>
          {filter.dayFilter
            ? `${filter.filteredCount} / ${filter.totalCount} 個方案`
            : `${filter.totalCount} 個方案可選`}
        </p>
      </div>

      {/* Day picker (overlapping the hero) */}
      {filter.availableDays.length > 0 && (
        <div style={{ padding: '0 16px', marginTop: -18 }}>
          <DayPicker
            value={filter.pickerDays}
            onChange={filter.onChange}
            min={filter.minDay}
            max={filter.maxDay}
            presets={filter.presets}
            label="想用幾天？"
            caption={filter.dayFilter
              ? (filter.filteredCount > 0 ? `找到 ${filter.filteredCount} 個 ${filter.dayFilter} 天方案` : `沒有 ${filter.dayFilter} 天的方案`)
              : '選擇天數即可篩選方案'}
          />
          {filter.dayFilter > 0 && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
              <button
                type="button"
                onClick={filter.onClear}
                style={{
                  background: 'transparent', border: `1px solid ${S.line}`, color: S.muted,
                  fontSize: 12, fontWeight: 600, padding: '5px 14px',
                  borderRadius: 100, cursor: 'pointer',
                }}
              >顯示全部</button>
            </div>
          )}
        </div>
      )}

      {/* 方案卡片 */}
      <div style={{ padding: '16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filter.totalCount === 0 && (
          <p style={{ textAlign: 'center', color: S.faint, padding: '48px 0', fontSize: 14 }}>此目的地暫無可購買方案</p>
        )}

        {showNoMatch && filter.nearestDays.length > 0 && (
          <div style={{ padding: '8px 4px' }}>
            <p style={{ fontSize: 13, color: S.muted, margin: '0 0 8px' }}>您也可以選擇相近天數：</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {filter.nearestDays.map(n => (
                <button
                  key={n}
                  onClick={() => filter.onChange(n)}
                  style={{
                    padding: '6px 12px', borderRadius: 100,
                    border: `1px solid ${C.border}`, background: C.light, color: C.primary,
                    fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  }}
                >{n} 天</button>
              ))}
            </div>
          </div>
        )}

        {products.map(p => {
          const { bestPrice, savedAmount, hasDiscount } = calcBestPrice(coupons, p.sellPrice)
          const inCart = cart.has(p.id)
          return (
            <div
              key={p.id}
              style={{
                width: '100%',
                background: S.white, borderRadius: 18,
                boxShadow: inCart
                  ? `0 4px 20px ${C.primary}33, 0 0 0 1.5px ${C.primary}`
                  : '0 2px 16px rgba(0,0,0,0.08)',
                display: 'grid', gridTemplateColumns: '1fr auto',
                padding: '20px', gap: 12,
                position: 'relative',
                transition: 'box-shadow 0.18s',
              }}
            >
              <button
                onClick={() => onSelectProduct(p.id)}
                style={{
                  background: 'transparent', border: 'none', textAlign: 'left',
                  cursor: 'pointer', padding: 0,
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
                  <span style={{ fontSize: 36, fontWeight: 900, color: S.ink, letterSpacing: '-0.04em', lineHeight: 1 }}>{p.displayDays}</span>
                  <span style={{ fontSize: 14, color: S.muted }}>天</span>
                </div>
                {p.dataCapacity && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    fontSize: 12, fontWeight: 700, color: C.primary,
                    background: C.light, borderRadius: 8, padding: '3px 10px',
                    marginBottom: 6,
                  }}>
                    📶 {p.dataCapacity}
                  </span>
                )}
                {p.description && (
                  <p style={{ fontSize: 12, color: S.faint, margin: 0, lineHeight: 1.5 }}>
                    {p.description}
                  </p>
                )}
              </button>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ textAlign: 'right' }}>
                  {hasDiscount && (
                    <p style={{ fontSize: 11, color: S.faint, margin: '0 0 2px', textDecoration: 'line-through' }}>
                      NT${p.sellPrice.toLocaleString()}
                    </p>
                  )}
                  <p style={{ fontSize: 22, fontWeight: 800, color: C.primary, margin: 0, letterSpacing: '-0.02em' }}>
                    NT${bestPrice.toLocaleString()}
                  </p>
                  {hasDiscount && (
                    <p style={{ fontSize: 10, color: '#16a34a', fontWeight: 700, margin: '2px 0 0' }}>
                      省 NT${savedAmount.toLocaleString()}
                    </p>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); cart.toggle(p) }}
                    aria-label={inCart ? '從購物車移除' : '加入購物車'}
                    style={{
                      width: 36, height: 36, borderRadius: 10,
                      background: inCart ? C.primary : C.light,
                      color: inCart ? C.onPrimary : C.primary,
                      border: 'none',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'background 0.15s, color 0.15s',
                      WebkitTapHighlightColor: 'transparent',
                    }}
                  >
                    {inCart ? <CheckIcon /> : <PlusIcon />}
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectProduct(p.id)}
                    style={{
                      background: C.primary, borderRadius: 10, border: 'none',
                      padding: '8px 14px', fontSize: 13, fontWeight: 700,
                      color: C.onPrimary, cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      WebkitTapHighlightColor: 'transparent',
                    }}
                  >
                    購買
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
