'use client'

import { useMemo } from 'react'
import { GlobeIllustration } from '@/components/liff/LiffIllustrations'
import { calcBestPrice } from '@/lib/utils/coupon-combo'
import { CountryFlag } from '@/components/common/CountryFlag'
import DayPicker from '@/components/liff/DayPicker'
import { annotatePlans, sortByValue, TIER_LABEL, TIER_COLOR } from '@/lib/utils/product-display'
import { NetworkBadge, NativeSimBadge } from '@/components/liff/ProductBadges'
import type { ProductsTemplateProps } from './types'

const S = {
  bg: '#f7f8fa', white: '#ffffff', ink: '#0f172a',
  muted: '#475569', faint: '#94a3b8', line: 'rgba(15,23,42,0.08)',
} as const

function BackArrow() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}

function CartPlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="20" r="1.2" fill="currentColor" />
      <circle cx="18" cy="20" r="1.2" fill="currentColor" />
      <path d="M2.5 3h2.6l2.4 12.1a2 2 0 0 0 2 1.6h9.3a2 2 0 0 0 2-1.55L22.5 7H6.3" />
      <line x1="14" y1="9" x2="14" y2="13" />
      <line x1="12" y1="11" x2="16" y2="11" />
    </svg>
  )
}

function CartCheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function CrownIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 18l-2-11 6 4 5-8 5 8 6-4-2 11H3zm0 2h18v2H3v-2z" />
    </svg>
  )
}

export default function ClassicShop({
  countries, products, coupons, selectedCountry,
  colors: C, onSelectCountry, onSelectProduct, onBack,
  filter, cart,
}: ProductsTemplateProps) {
  // Country selection screen
  if (!selectedCountry) {
    return (
      <div style={{ maxWidth: 520, margin: '0 auto', paddingBottom: 96, background: S.bg, minHeight: '100vh' }}>
        <div style={{ padding: '40px 24px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <GlobeIllustration size={110} />
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: 26, fontWeight: 900, color: S.ink, letterSpacing: '-0.03em', margin: 0 }}>選擇目的地</h1>
            <p style={{ fontSize: 13, color: S.faint, marginTop: 6 }}>購買出國 eSIM · 即插即用</p>
          </div>
        </div>

        {countries.length === 0 ? (
          <p style={{ textAlign: 'center', color: S.faint, padding: '48px 0', fontSize: 14 }}>目前沒有可購買的商品</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '0 16px' }}>
            {countries.map(c => (
              <button
                key={c.countryCode}
                onClick={() => onSelectCountry(c.countryCode)}
                style={{
                  background: S.white, border: `1px solid ${S.line}`,
                  borderRadius: 18, padding: '20px 16px',
                  textAlign: 'left', cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 4px 12px rgba(15,23,42,0.03)',
                  WebkitTapHighlightColor: 'transparent',
                  transition: 'transform 0.15s, box-shadow 0.15s',
                }}
              >
                <div style={{ marginBottom: 12 }}>
                  <CountryFlag code={c.countryCode} fallbackEmoji={c.countryFlag} size={44} />
                </div>
                <p style={{ fontSize: 15, fontWeight: 700, color: S.ink, margin: 0, letterSpacing: '-0.01em' }}>{c.countryNameZh}</p>
                <p style={{ fontSize: 11, color: S.faint, marginTop: 4, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{c.countryNameEn}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  const country = countries.find(c => c.countryCode === selectedCountry)
  const showNoMatch = filter.dayFilter > 0 && filter.filteredCount === 0

  // Annotate + sort by per-day value
  const displays = useMemo(() => sortByValue(annotatePlans(products)), [products])

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', paddingBottom: 96, background: S.bg, minHeight: '100vh' }}>
      {/* Sticky header */}
      <div style={{
        position: 'sticky', top: 0,
        background: 'rgba(247,248,250,0.92)', backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        zIndex: 10, padding: '14px 16px 12px',
        borderBottom: `1px solid ${S.line}`,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: S.muted, display: 'flex', alignItems: 'center' }}>
          <BackArrow />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {country && <CountryFlag code={country.countryCode} fallbackEmoji={country.countryFlag} size={22} />}
            <h1 style={{ fontSize: 17, fontWeight: 800, color: S.ink, margin: 0, letterSpacing: '-0.01em' }}>{country?.countryNameZh ?? '方案'}</h1>
          </div>
          <p style={{ fontSize: 11, color: S.faint, margin: '2px 0 0', letterSpacing: '0.04em' }}>
            {filter.dayFilter ? `已篩選 ${filter.filteredCount} / ${filter.totalCount}` : `${filter.totalCount} 個方案`}
          </p>
        </div>
        {filter.dayFilter > 0 && (
          <button
            type="button"
            onClick={filter.onClear}
            style={{
              background: 'transparent', border: `1px solid ${S.line}`, color: S.muted,
              fontSize: 12, fontWeight: 600, padding: '6px 11px',
              borderRadius: 100, cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent',
            }}
          >全部</button>
        )}
      </div>

      {/* Day picker */}
      {filter.availableDays.length > 0 && (
        <div style={{ padding: '16px 16px 4px' }}>
          <DayPicker
            value={filter.pickerDays}
            onChange={filter.onChange}
            min={filter.minDay}
            max={filter.maxDay}
            presets={filter.presets}
            label="想用幾天？"
            caption={filter.dayFilter
              ? (filter.filteredCount > 0 ? `找到 ${filter.filteredCount} 個 ${filter.dayFilter} 天方案` : `沒有 ${filter.dayFilter} 天的方案`)
              : '點 +/− 或輸入即可篩選'}
          />
        </div>
      )}

      {/* Plans */}
      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
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
                    padding: '7px 14px', borderRadius: 100,
                    border: `1px solid ${C.border}`, background: C.light, color: C.primary,
                    fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  }}
                >{n} 天</button>
              ))}
            </div>
          </div>
        )}

        {displays.map(d => {
          const p = d.plan
          const { bestPrice, savedAmount, hasDiscount } = calcBestPrice(coupons, p.sellPrice)
          const inCart = cart.has(p.id)
          const tier = TIER_COLOR[d.tier]
          return (
            <div
              key={p.id}
              style={{
                position: 'relative',
                width: '100%', background: S.white, borderRadius: 18,
                border: `1px solid ${inCart ? C.border : S.line}`,
                boxShadow: inCart
                  ? `0 2px 6px rgba(15,23,42,0.04), 0 0 0 1.5px ${C.primary}33`
                  : '0 1px 2px rgba(15,23,42,0.04), 0 4px 12px rgba(15,23,42,0.03)',
                overflow: 'hidden',
                transition: 'box-shadow 0.18s',
              }}
            >
              {/* Best value ribbon */}
              {d.recommended && (
                <div style={{
                  position: 'absolute', top: 0, left: 0,
                  background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                  color: '#fff',
                  fontSize: 10, fontWeight: 800,
                  padding: '4px 10px 4px 10px',
                  borderTopLeftRadius: 18, borderBottomRightRadius: 10,
                  display: 'flex', alignItems: 'center', gap: 3,
                  letterSpacing: '0.08em',
                  zIndex: 1,
                }}>
                  <CrownIcon size={11} /> 最划算
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'stretch' }}>
                <button
                  type="button"
                  onClick={() => onSelectProduct(p.id)}
                  style={{
                    flex: 1, background: 'transparent', border: 'none',
                    padding: d.recommended ? '26px 18px 18px' : '18px',
                    cursor: 'pointer', textAlign: 'left',
                    WebkitTapHighlightColor: 'transparent',
                    display: 'flex', alignItems: 'center', gap: 14,
                  }}
                >
                  {/* Day badge with tier accent */}
                  <div style={{
                    width: 64, height: 64, borderRadius: 16, flexShrink: 0,
                    background: tier.bg, color: tier.fg,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ fontSize: 24, fontWeight: 900, lineHeight: 1, letterSpacing: '-0.03em' }}>{p.displayDays}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, marginTop: 2, letterSpacing: '0.1em' }}>天</span>
                  </div>

                  {/* Mid info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5, flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, color: tier.accent,
                        background: tier.bg, borderRadius: 6, padding: '3px 8px',
                        letterSpacing: '0.04em',
                      }}>{TIER_LABEL[d.tier]}</span>
                      {p.dataCapacity && (
                        <span style={{ fontSize: 13, fontWeight: 700, color: S.ink, letterSpacing: '-0.01em' }}>
                          {p.dataCapacity}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5, flexWrap: 'wrap' }}>
                      <NetworkBadge networkType={p.networkType} />
                      <NativeSimBadge isNative={p.isNativeSim} />
                    </div>
                    {d.totalGB > 0 && !d.isUnlimited && d.isPerDay && (
                      <p style={{ fontSize: 11, color: S.faint, margin: 0 }}>
                        共 {Math.round(d.totalGB)} GB
                      </p>
                    )}
                  </div>

                  {/* Price */}
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    {hasDiscount && (
                      <p style={{ fontSize: 11, color: S.faint, margin: 0, textDecoration: 'line-through' }}>
                        NT${p.sellPrice.toLocaleString()}
                      </p>
                    )}
                    <p style={{ fontSize: 20, fontWeight: 900, color: C.primary, margin: 0, letterSpacing: '-0.03em', lineHeight: 1.1 }}>
                      NT${bestPrice.toLocaleString()}
                    </p>
                    {hasDiscount && (
                      <p style={{ fontSize: 10, color: '#16a34a', margin: '2px 0 0', fontWeight: 700 }}>
                        省 NT${savedAmount.toLocaleString()}
                      </p>
                    )}
                  </div>
                </button>

                {/* Add to cart */}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); cart.toggle(p) }}
                  aria-label={inCart ? '從購物車移除' : '加入購物車'}
                  style={{
                    width: 52, flexShrink: 0,
                    background: inCart ? C.primary : 'transparent',
                    color: inCart ? C.onPrimary : C.primary,
                    border: 'none', borderLeft: `1px solid ${inCart ? 'transparent' : S.line}`,
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background 0.15s, color 0.15s',
                    WebkitTapHighlightColor: 'transparent',
                  }}
                >
                  {inCart ? <CartCheckIcon /> : <CartPlusIcon />}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
