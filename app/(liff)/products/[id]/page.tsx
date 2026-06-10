'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { SignalIllustration } from '@/components/liff/LiffIllustrations'
import { useTenantColors } from '@/components/liff/TenantContext'
import { calcBestPrice, type CouponItem } from '@/lib/utils/coupon-combo'
import { CountryFlag } from '@/components/common/CountryFlag'

type Product = {
  id: string
  countryCode: string
  countryNameZh: string
  countryNameEn: string
  countryFlag: string | null
  displayDays: number
  dataCapacity: string | null
  description: string | null
  sellPrice: number
}

const S = {
  bg: '#f9f9f9',
  white: '#ffffff',
  ink: '#1a1a1a',
  muted: '#4b5563',
  faint: '#94a3b8',
  line: 'rgba(0,0,0,0.07)',
} as const

function BackArrow() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}

function CheckIcon({ color }: { color: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

export default function ProductDetailPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const C = useTenantColors()
  const [product, setProduct] = useState<Product | null>(null)
  const [coupons, setCoupons] = useState<CouponItem[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch(`/api/products/${id}`).then(r => {
        if (r.status === 404) { setNotFound(true); return null }
        return r.json()
      }),
      fetch('/api/coupons').then(r => r.json()).catch(() => ({ coupons: [] })),
    ]).then(([prodData, couponData]) => {
      if (prodData) setProduct(prodData.product)
      const now = new Date()
      setCoupons(
        (couponData.coupons ?? [])
          .filter((c: CouponItem & { usedAt?: string | null; expiresAt?: string | null }) =>
            !c.usedAt && (!c.expiresAt || new Date(c.expiresAt) > now)
          )
          .map((c: CouponItem) => ({ id: c.id, discount: c.discount }))
      )
    }).finally(() => setLoading(false))
  }, [id])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ width: 28, height: 28, border: `2.5px solid ${C.light}`, borderTopColor: C.primary, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (notFound || !product) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 16 }}>
      <p style={{ color: S.faint, fontSize: 14 }}>商品不存在或已下架</p>
      <button onClick={() => router.back()} style={{ color: C.primary, fontSize: 14, background: 'none', border: 'none', cursor: 'pointer' }}>返回上一頁</button>
    </div>
  )

  const descLines = product.description?.split('\n').filter(Boolean) ?? []

  const features = [
    product.dataCapacity ? product.dataCapacity : null,
    'eSIM 即插即用，無需實體 SIM',
    '購買後即可收到安裝教學',
  ].filter(Boolean) as string[]

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', paddingBottom: 100 }}>
      {/* Nav bar */}
      <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          onClick={() => router.back()}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: S.muted, display: 'flex', alignItems: 'center', padding: 4 }}
        >
          <BackArrow />
        </button>
        <span style={{ fontSize: 14, color: S.muted }}>{product.countryNameZh}</span>
      </div>

      {/* Hero card */}
      <div style={{ margin: '0 16px', background: S.white, borderRadius: 20, border: `1px solid ${S.line}`, overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
        {/* Top band */}
        <div style={{
          background: `linear-gradient(135deg, ${C.light} 0%, ${C.soft} 100%)`,
          padding: '28px 24px 22px',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <CountryFlag code={product.countryCode} fallbackEmoji={product.countryFlag} size={36} />
              <div>
                <p style={{ fontSize: 17, fontWeight: 700, color: S.ink, margin: 0 }}>{product.countryNameZh}</p>
                <p style={{ fontSize: 12, color: S.faint, margin: 0 }}>{product.countryNameEn}</p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontSize: 40, fontWeight: 800, color: S.ink, letterSpacing: '-0.04em', lineHeight: 1 }}>{product.displayDays}</span>
              <span style={{ fontSize: 16, color: S.muted, fontWeight: 500 }}>天方案</span>
            </div>
          </div>
          <SignalIllustration size={54} />
        </div>

        {/* Specs */}
        <div style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {features.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                  background: C.light,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <CheckIcon color={C.primary} />
                </div>
                <span style={{ fontSize: 14, color: S.muted }}>{f}</span>
              </div>
            ))}
          </div>

          {descLines.length > 0 && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${S.line}` }}>
              {descLines.map((line, i) => (
                <p key={i} style={{ fontSize: 13, color: S.faint, margin: i > 0 ? '4px 0 0' : 0 }}>{line}</p>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Sticky CTA */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'rgba(249,249,249,0.97)',
        backdropFilter: 'blur(10px)',
        borderTop: `1px solid ${S.line}`,
        padding: '12px 16px',
        paddingBottom: 'calc(12px + env(safe-area-inset-bottom))',
      }}>
        <div style={{ maxWidth: 520, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div>
            {(() => {
              const { bestPrice, savedAmount, hasDiscount } = calcBestPrice(coupons, product.sellPrice)
              return hasDiscount ? (
                <>
                  <p style={{ fontSize: 11, color: S.faint, margin: 0, textDecoration: 'line-through' }}>
                    NT${product.sellPrice.toLocaleString()}
                  </p>
                  <p style={{ fontSize: 26, fontWeight: 800, color: C.primary, margin: 0, letterSpacing: '-0.03em', lineHeight: 1.1 }}>
                    NT${bestPrice.toLocaleString()}
                  </p>
                  <p style={{ fontSize: 11, color: '#16a34a', marginTop: 1, fontWeight: 600 }}>
                    套用優惠券省 NT${savedAmount.toLocaleString()}
                  </p>
                </>
              ) : (
                <>
                  <p style={{ fontSize: 11, color: S.faint, margin: 0 }}>售價</p>
                  <p style={{ fontSize: 26, fontWeight: 800, color: C.primary, margin: 0, letterSpacing: '-0.03em', lineHeight: 1.1 }}>
                    NT${product.sellPrice.toLocaleString()}
                  </p>
                </>
              )
            })()}
          </div>
          <button
            onClick={() => router.push(`/checkout?productId=${product.id}`)}
            style={{
              flex: 1,
              background: C.primary,
              border: 'none', borderRadius: 100,
              padding: '15px',
              color: C.onPrimary,
              fontSize: 16, fontWeight: 800,
              cursor: 'pointer',
              letterSpacing: '0.02em',
              boxShadow: `0 4px 14px ${C.primary}40`,
            }}
          >
            立即購買
          </button>
        </div>
      </div>
    </div>
  )
}
