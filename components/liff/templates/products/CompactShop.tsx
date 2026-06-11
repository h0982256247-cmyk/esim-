'use client'

import { calcBestPrice } from '@/lib/utils/coupon-combo'
import { CountryFlag } from '@/components/common/CountryFlag'
import DayPicker from '@/components/liff/DayPicker'
import type { ProductsTemplateProps } from './types'

const S = {
  ink: '#111', muted: '#6b7280', faint: '#9ca3af',
  white: '#ffffff', bg: '#f3f4f6', line: 'rgba(0,0,0,0.06)',
} as const

function BackArrow() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

export default function CompactShop({
  countries, products, coupons, selectedCountry,
  colors: C, onSelectCountry, onSelectProduct, onBack,
  filter, cart,
}: ProductsTemplateProps) {
  if (!selectedCountry) {
    return (
      <div style={{ paddingBottom: 96 }}>
        {/* 搜尋風格標題列 */}
        <div style={{
          padding: '20px 16px 12px',
          borderBottom: `1px solid ${S.line}`,
          background: S.white,
          position: 'sticky', top: 0, zIndex: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              flex: 1, background: S.bg, borderRadius: 12,
              padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={S.faint} strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <span style={{ fontSize: 14, color: S.faint }}>搜尋目的地</span>
            </div>
          </div>
        </div>

        {/* 密集列表 */}
        <div style={{ background: S.white }}>
          {countries.length === 0 && (
            <p style={{ textAlign: 'center', color: S.faint, padding: '48px 0', fontSize: 14 }}>目前沒有可購買的商品</p>
          )}
          {countries.map((c, i) => (
            <button
              key={c.countryCode}
              onClick={() => onSelectCountry(c.countryCode)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                background: 'none', border: 'none',
                borderBottom: i < countries.length - 1 ? `1px solid ${S.line}` : 'none',
                padding: '13px 16px', cursor: 'pointer', textAlign: 'left',
              }}
            >
              <span style={{ width: 32, display: 'inline-flex', justifyContent: 'center', flexShrink: 0 }}>
                <CountryFlag code={c.countryCode} fallbackEmoji={c.countryFlag} size={28} />
              </span>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 15, fontWeight: 600, color: S.ink, margin: 0 }}>{c.countryNameZh}</p>
                <p style={{ fontSize: 12, color: S.faint, margin: 0 }}>{c.countryNameEn}</p>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={S.faint} strokeWidth="2" strokeLinecap="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
          ))}
        </div>
      </div>
    )
  }

  const country = countries.find(c => c.countryCode === selectedCountry)
  const showNoMatch = filter.dayFilter > 0 && filter.filteredCount === 0

  return (
    <div style={{ paddingBottom: 96 }}>
      {/* 頂欄 */}
      <div style={{
        background: S.white, padding: '14px 16px',
        borderBottom: `1px solid ${S.line}`,
        position: 'sticky', top: 0, zIndex: 10,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: S.muted, padding: 4, display: 'flex', alignItems: 'center' }}>
          <BackArrow />
        </button>
        {country && <CountryFlag code={country.countryCode} fallbackEmoji={country.countryFlag} size={26} />}
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 16, fontWeight: 700, color: S.ink, margin: 0 }}>{country?.countryNameZh}</p>
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
              fontSize: 12, fontWeight: 600, padding: '5px 10px',
              borderRadius: 100, cursor: 'pointer',
            }}
          >全部</button>
        )}
      </div>

      {/* DayPicker (compact) */}
      {filter.availableDays.length > 0 && (
        <div style={{ padding: '10px 16px 4px', background: S.white, borderBottom: `1px solid ${S.line}` }}>
          <DayPicker
            value={filter.pickerDays}
            onChange={filter.onChange}
            min={filter.minDay}
            max={filter.maxDay}
            presets={filter.presets}
            label="想用幾天？"
            caption={filter.dayFilter
              ? (filter.filteredCount > 0 ? `${filter.filteredCount} 個方案` : `沒有 ${filter.dayFilter} 天方案`)
              : '點 +/− 篩選'}
            compact
          />
        </div>
      )}

      {/* 方案列表（密集） */}
      <div style={{ background: S.white, marginTop: 8 }}>
        {filter.totalCount === 0 && (
          <p style={{ textAlign: 'center', color: S.faint, padding: '48px 0', fontSize: 14 }}>此目的地暫無可購買方案</p>
        )}

        {showNoMatch && filter.nearestDays.length > 0 && (
          <div style={{ padding: '16px' }}>
            <p style={{ fontSize: 13, color: S.muted, margin: '0 0 8px' }}>相近天數：</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
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

        {products.map((p, i) => {
          const { bestPrice, savedAmount, hasDiscount } = calcBestPrice(coupons, p.sellPrice)
          const inCart = cart.has(p.id)
          return (
            <div
              key={p.id}
              style={{
                display: 'flex', alignItems: 'stretch',
                borderBottom: i < products.length - 1 ? `1px solid ${S.line}` : 'none',
              }}
            >
              <button
                onClick={() => onSelectProduct(p.id)}
                style={{
                  flex: 1, textAlign: 'left', background: 'none', border: 'none',
                  padding: '14px 16px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 12,
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                {/* 天數 badge */}
                <div style={{
                  width: 52, height: 52, borderRadius: 12, flexShrink: 0,
                  background: C.light,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: 20, fontWeight: 900, color: C.primary, lineHeight: 1 }}>{p.displayDays}</span>
                  <span style={{ fontSize: 10, color: C.primary, fontWeight: 600 }}>天</span>
                </div>

                {/* 資訊 */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {p.dataCapacity && (
                      <span style={{ fontSize: 12, fontWeight: 700, color: S.muted, background: S.bg, borderRadius: 6, padding: '1px 7px' }}>
                        {p.dataCapacity}
                      </span>
                    )}
                  </div>
                  {p.description && (
                    <p style={{ fontSize: 12, color: S.faint, margin: '3px 0 0', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                      {p.description}
                    </p>
                  )}
                </div>

                {/* 價格 */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  {hasDiscount ? (
                    <>
                      <p style={{ fontSize: 11, color: S.faint, margin: 0, textDecoration: 'line-through' }}>NT${p.sellPrice.toLocaleString()}</p>
                      <p style={{ fontSize: 17, fontWeight: 800, color: C.primary, margin: 0 }}>NT${bestPrice.toLocaleString()}</p>
                      <p style={{ fontSize: 10, color: '#16a34a', fontWeight: 600, margin: 0 }}>省{savedAmount}</p>
                    </>
                  ) : (
                    <p style={{ fontSize: 17, fontWeight: 800, color: C.primary, margin: 0 }}>NT${p.sellPrice.toLocaleString()}</p>
                  )}
                </div>
              </button>

              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); cart.toggle(p) }}
                aria-label={inCart ? '從購物車移除' : '加入購物車'}
                style={{
                  width: 44, flexShrink: 0,
                  background: inCart ? C.primary : 'transparent',
                  color: inCart ? C.onPrimary : C.primary,
                  border: 'none',
                  borderLeft: `1px solid ${S.line}`,
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
