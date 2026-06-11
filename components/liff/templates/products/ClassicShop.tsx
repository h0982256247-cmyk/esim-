'use client'

import { GlobeIllustration } from '@/components/liff/LiffIllustrations'
import { calcBestPrice } from '@/lib/utils/coupon-combo'
import { CountryFlag } from '@/components/common/CountryFlag'
import DayPicker from '@/components/liff/DayPicker'
import type { ProductsTemplateProps } from './types'

const S = {
  bg: '#f9f9f9', white: '#ffffff', ink: '#1a1a1a',
  muted: '#4b5563', faint: '#94a3b8', line: 'rgba(0,0,0,0.07)',
} as const

function BackArrow() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}

function PlusIconSm() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function CheckIconSm() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

export default function ClassicShop({
  countries, products, coupons, selectedCountry,
  colors: C, onSelectCountry, onSelectProduct, onBack,
  filter, cart,
}: ProductsTemplateProps) {
  if (!selectedCountry) {
    return (
      <div style={{ maxWidth: 520, margin: '0 auto', paddingBottom: 96 }}>
        <div style={{ padding: '32px 24px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <GlobeIllustration size={110} />
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: S.ink, letterSpacing: '-0.02em', margin: 0 }}>選擇目的地</h1>
            <p style={{ fontSize: 13, color: S.faint, marginTop: 6 }}>購買出國 eSIM，即插即用</p>
          </div>
        </div>

        {countries.length === 0 ? (
          <p style={{ textAlign: 'center', color: S.faint, padding: '48px 0', fontSize: 14 }}>目前沒有可購買的商品</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '0 16px' }}>
            {countries.map(c => (
              <button
                key={c.countryCode}
                onClick={() => onSelectCountry(c.countryCode)}
                style={{
                  background: S.white, border: `1px solid ${S.line}`,
                  borderRadius: 14, padding: '18px 14px',
                  textAlign: 'left', cursor: 'pointer',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                }}
              >
                <div style={{ marginBottom: 10 }}>
                  <CountryFlag code={c.countryCode} fallbackEmoji={c.countryFlag} size={44} />
                </div>
                <p style={{ fontSize: 15, fontWeight: 700, color: S.ink, margin: 0 }}>{c.countryNameZh}</p>
                <p style={{ fontSize: 12, color: S.faint, marginTop: 3 }}>{c.countryNameEn}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  const country = countries.find(c => c.countryCode === selectedCountry)
  const showNoMatch = filter.dayFilter > 0 && filter.filteredCount === 0

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', paddingBottom: 96 }}>
      <div style={{
        position: 'sticky', top: 0,
        background: 'rgba(249,249,249,0.96)', backdropFilter: 'blur(10px)',
        zIndex: 10, padding: '14px 16px',
        borderBottom: `1px solid ${S.line}`,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: S.muted, display: 'flex', alignItems: 'center' }}>
          <BackArrow />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {country && <CountryFlag code={country.countryCode} fallbackEmoji={country.countryFlag} size={22} />}
            <h1 style={{ fontSize: 17, fontWeight: 700, color: S.ink, margin: 0 }}>{country?.countryNameZh ?? '方案'}</h1>
          </div>
          <p style={{ fontSize: 12, color: S.faint, margin: 0 }}>
            {filter.dayFilter ? `${filter.filteredCount} / ${filter.totalCount} 個方案` : `${filter.totalCount} 個方案`}
          </p>
        </div>
        {filter.dayFilter > 0 && (
          <button
            type="button"
            onClick={filter.onClear}
            style={{
              background: 'transparent', border: `1px solid ${S.line}`, color: S.muted,
              fontSize: 12, fontWeight: 600, padding: '6px 10px',
              borderRadius: 100, cursor: 'pointer',
            }}
          >顯示全部</button>
        )}
      </div>

      {filter.availableDays.length > 0 && (
        <div style={{ padding: '14px 16px 4px' }}>
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
        </div>
      )}

      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
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
                width: '100%', background: S.white, borderRadius: 14,
                border: `1px solid ${inCart ? C.border : S.line}`,
                boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                display: 'flex', alignItems: 'stretch', overflow: 'hidden',
              }}
            >
              <button
                type="button"
                onClick={() => onSelectProduct(p.id)}
                style={{
                  flex: 1, textAlign: 'left',
                  background: 'transparent', border: 'none',
                  padding: '16px 16px 16px 18px',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
                    <span style={{ fontSize: 22, fontWeight: 800, color: S.ink, letterSpacing: '-0.02em' }}>{p.displayDays}</span>
                    <span style={{ fontSize: 13, color: S.muted, fontWeight: 500 }}>天</span>
                  </div>
                  {p.dataCapacity && (
                    <span style={{ display: 'inline-block', fontSize: 12, fontWeight: 600, color: S.muted, background: '#f3f4f6', borderRadius: 6, padding: '2px 8px', marginBottom: 4 }}>
                      {p.dataCapacity}
                    </span>
                  )}
                  {p.description && (
                    <p style={{ fontSize: 12, color: S.faint, margin: 0, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' }}>
                      {p.description}
                    </p>
                  )}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  {hasDiscount ? (
                    <>
                      <p style={{ fontSize: 12, color: S.faint, margin: 0, textDecoration: 'line-through' }}>NT${p.sellPrice.toLocaleString()}</p>
                      <p style={{ fontSize: 22, fontWeight: 800, color: C.primary, margin: 0 }}>NT${bestPrice.toLocaleString()}</p>
                      <p style={{ fontSize: 11, color: '#16a34a', marginTop: 1, fontWeight: 600 }}>省 NT${savedAmount.toLocaleString()}</p>
                    </>
                  ) : (
                    <p style={{ fontSize: 22, fontWeight: 800, color: C.primary, margin: 0 }}>NT${p.sellPrice.toLocaleString()}</p>
                  )}
                </div>
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); cart.toggle(p) }}
                aria-label={inCart ? '從購物車移除' : '加入購物車'}
                style={{
                  width: 52, flexShrink: 0,
                  background: inCart ? C.primary : C.light,
                  color: inCart ? C.onPrimary : C.primary,
                  border: 'none',
                  borderLeft: `1px solid ${inCart ? 'transparent' : S.line}`,
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.15s, color 0.15s',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                {inCart ? <CheckIconSm /> : <PlusIconSm />}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
