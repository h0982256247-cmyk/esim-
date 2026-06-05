'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { SignalIllustration } from '@/components/liff/LiffIllustrations'

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
  bg: '#f8f9fb',
  white: '#ffffff',
  ink: '#0f172a',
  muted: '#64748b',
  faint: '#94a3b8',
  line: 'rgba(0,0,0,0.07)',
  accent: '#0284c7',
  accentLight: '#e0f2fe',
} as const

function BackArrow() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={S.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

export default function ProductDetailPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    fetch(`/api/products/${id}`)
      .then(r => { if (r.status === 404) { setNotFound(true); return null } return r.json() })
      .then(data => { if (data) setProduct(data.product) })
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ width: 28, height: 28, border: '2.5px solid #e0f2fe', borderTopColor: S.accent, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (notFound || !product) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 16 }}>
      <p style={{ color: S.faint, fontSize: 14 }}>商品不存在或已下架</p>
      <button onClick={() => router.back()} style={{ color: S.accent, fontSize: 14, background: 'none', border: 'none', cursor: 'pointer' }}>返回上一頁</button>
    </div>
  )

  const descLines = product.description?.split('\n').filter(Boolean) ?? []

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
        <span style={{ fontSize: 14, color: S.muted }}>
          {product.countryNameZh}
        </span>
      </div>

      {/* Hero card */}
      <div style={{ margin: '0 16px', background: S.white, borderRadius: 20, border: `1px solid ${S.line}`, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        {/* Top band */}
        <div style={{ background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)', padding: '28px 24px 20px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              {product.countryFlag && <span style={{ fontSize: 24 }}>{product.countryFlag}</span>}
              <div>
                <p style={{ fontSize: 17, fontWeight: 700, color: S.ink, margin: 0 }}>{product.countryNameZh}</p>
                <p style={{ fontSize: 12, color: S.faint, margin: 0 }}>{product.countryNameEn}</p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontSize: 36, fontWeight: 800, color: S.ink, letterSpacing: '-0.03em' }}>{product.displayDays}</span>
              <span style={{ fontSize: 16, color: S.muted, fontWeight: 500 }}>天方案</span>
            </div>
          </div>
          <SignalIllustration size={56} />
        </div>

        {/* Specs */}
        <div style={{ padding: '20px 24px' }}>
          {product.dataCapacity && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <CheckIcon />
              <span style={{ fontSize: 14, color: S.muted }}>{product.dataCapacity}</span>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <CheckIcon />
            <span style={{ fontSize: 14, color: S.muted }}>eSIM 即插即用，無需實體 SIM</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <CheckIcon />
            <span style={{ fontSize: 14, color: S.muted }}>購買後即可收到安裝教學</span>
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
        background: 'rgba(248,249,251,0.96)',
        backdropFilter: 'blur(10px)',
        borderTop: `1px solid ${S.line}`,
        padding: '12px 16px',
        paddingBottom: 'calc(12px + env(safe-area-inset-bottom))',
      }}>
        <div style={{ maxWidth: 520, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div>
            <p style={{ fontSize: 11, color: S.faint, margin: 0 }}>售價</p>
            <p style={{ fontSize: 24, fontWeight: 800, color: S.ink, margin: 0, letterSpacing: '-0.02em' }}>NT${product.sellPrice.toLocaleString()}</p>
          </div>
          <button
            onClick={() => router.push(`/checkout?productId=${product.id}`)}
            style={{
              flex: 1,
              background: S.accent,
              border: 'none',
              borderRadius: 14,
              padding: '15px',
              color: '#fff',
              fontSize: 16,
              fontWeight: 700,
              cursor: 'pointer',
              letterSpacing: '0.02em',
            }}
          >
            立即購買
          </button>
        </div>
      </div>
    </div>
  )
}
