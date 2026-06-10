'use client'

import { GlobeIllustration } from '@/components/liff/LiffIllustrations'
import { calcBestPrice } from '@/lib/utils/coupon-combo'
import { CountryFlag } from '@/components/common/CountryFlag'
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

export default function ClassicShop({
  countries, products, coupons, selectedCountry,
  colors: C, onSelectCountry, onSelectProduct, onBack,
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
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {country && <CountryFlag code={country.countryCode} fallbackEmoji={country.countryFlag} size={22} />}
            <h1 style={{ fontSize: 17, fontWeight: 700, color: S.ink, margin: 0 }}>{country?.countryNameZh ?? '方案'}</h1>
          </div>
          <p style={{ fontSize: 12, color: S.faint, margin: 0 }}>{products.length} 個方案</p>
        </div>
      </div>

      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {products.length === 0 && (
          <p style={{ textAlign: 'center', color: S.faint, padding: '48px 0', fontSize: 14 }}>此目的地暫無可購買方案</p>
        )}
        {products.map(p => {
          const { bestPrice, savedAmount, hasDiscount } = calcBestPrice(coupons, p.sellPrice)
          return (
            <button
              key={p.id}
              onClick={() => onSelectProduct(p.id)}
              style={{
                width: '100%', textAlign: 'left',
                background: S.white, borderRadius: 14,
                border: `1px solid ${S.line}`, padding: '16px 18px',
                cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
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
                  <>
                    <p style={{ fontSize: 22, fontWeight: 800, color: C.primary, margin: 0 }}>NT${p.sellPrice.toLocaleString()}</p>
                    <p style={{ fontSize: 11, color: S.faint, marginTop: 2 }}>點選購買</p>
                  </>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
