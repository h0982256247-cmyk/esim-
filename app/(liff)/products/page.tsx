'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useLiff } from '@/components/liff/LiffProvider'
import { GlobeIllustration } from '@/components/liff/LiffIllustrations'

type Country = {
  countryCode: string
  countryNameZh: string
  countryNameEn: string
  countryFlag: string | null
}

type Product = {
  id: string
  countryCode: string
  countryNameZh: string
  countryNameEn: string
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

function Spinner() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', gap: 16 }}>
      <GlobeIllustration size={80} />
      <p style={{ fontSize: 13, color: S.faint, letterSpacing: '0.04em' }}>載入中</p>
    </div>
  )
}

function BackArrow() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <ProductsContent />
    </Suspense>
  )
}

function ProductsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const selectedCountry = searchParams.get('country')
  const { liff, isReady } = useLiff()

  const [countries, setCountries] = useState<Country[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isReady) return
    async function load() {
      let lineUid: string | undefined
      try { if (liff) lineUid = (await liff.getProfile()).userId } catch {}
      const params = new URLSearchParams()
      if (selectedCountry) params.set('country', selectedCountry)
      if (lineUid) params.set('lineUid', lineUid)
      const data = await fetch(`/api/products${params.toString() ? `?${params}` : ''}`).then(r => r.json())
      setCountries(data.countries ?? [])
      setProducts(data.products ?? [])
      setLoading(false)
    }
    load()
  }, [selectedCountry, isReady, liff])

  if (loading) return <Spinner />

  // ── 國家選擇畫面 (Step 1) ──
  if (!selectedCountry) {
    return (
      <div style={{ maxWidth: 520, margin: '0 auto', paddingBottom: 96 }}>
        {/* Hero */}
        <div style={{ padding: '32px 24px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <GlobeIllustration size={120} />
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: S.ink, letterSpacing: '-0.02em', margin: 0 }}>選擇目的地</h1>
            <p style={{ fontSize: 13, color: S.faint, marginTop: 4 }}>購買出國 eSIM，即插即用</p>
          </div>
        </div>

        {/* Country grid */}
        {countries.length === 0 ? (
          <p style={{ textAlign: 'center', color: S.faint, padding: '48px 0', fontSize: 14 }}>目前沒有可購買的商品</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '0 16px' }}>
            {countries.map(c => (
              <button
                key={c.countryCode}
                onClick={() => router.push(`/products?country=${c.countryCode}`)}
                style={{
                  background: S.white,
                  border: `1px solid ${S.line}`,
                  borderRadius: 14,
                  padding: '18px 14px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  transition: 'box-shadow 0.15s',
                }}
              >
                {c.countryFlag && (
                  <span style={{ fontSize: 28, display: 'block', marginBottom: 8, lineHeight: 1 }}>{c.countryFlag}</span>
                )}
                <p style={{ fontSize: 15, fontWeight: 700, color: S.ink, margin: 0 }}>{c.countryNameZh}</p>
                <p style={{ fontSize: 12, color: S.faint, marginTop: 2 }}>{c.countryNameEn}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── 方案選擇畫面 (Step 2) ──
  const country = countries.find(c => c.countryCode === selectedCountry)

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', paddingBottom: 96 }}>
      {/* Sticky header */}
      <div style={{
        position: 'sticky', top: 0,
        background: 'rgba(248,249,251,0.96)',
        backdropFilter: 'blur(10px)',
        zIndex: 10,
        padding: '14px 16px',
        borderBottom: `1px solid ${S.line}`,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        <button
          onClick={() => router.push('/products')}
          style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: S.muted, display: 'flex', alignItems: 'center' }}
        >
          <BackArrow />
        </button>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {country?.countryFlag && <span style={{ fontSize: 18 }}>{country.countryFlag}</span>}
            <h1 style={{ fontSize: 17, fontWeight: 700, color: S.ink, margin: 0 }}>{country?.countryNameZh ?? '方案'}</h1>
          </div>
          <p style={{ fontSize: 12, color: S.faint, margin: 0 }}>{products.length} 個方案</p>
        </div>
      </div>

      {/* Plans */}
      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {products.length === 0 && (
          <p style={{ textAlign: 'center', color: S.faint, padding: '48px 0', fontSize: 14 }}>此目的地暫無可購買方案</p>
        )}
        {products.map((p, i) => (
          <button
            key={p.id}
            onClick={() => router.push(`/products/${p.id}`)}
            style={{
              width: '100%',
              textAlign: 'left',
              background: S.white,
              borderRadius: 16,
              border: `1px solid ${S.line}`,
              padding: '18px 16px',
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 20, fontWeight: 800, color: S.ink }}>{p.displayDays}</span>
                <span style={{ fontSize: 13, color: S.muted, fontWeight: 500 }}>天</span>
              </div>
              {p.dataCapacity && (
                <p style={{ fontSize: 13, color: S.muted, margin: 0 }}>{p.dataCapacity}</p>
              )}
              {p.description && (
                <p style={{ fontSize: 12, color: S.faint, marginTop: 4, display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {p.description}
                </p>
              )}
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <p style={{ fontSize: 22, fontWeight: 800, color: S.accent, margin: 0, letterSpacing: '-0.02em' }}>
                NT${p.sellPrice.toLocaleString()}
              </p>
              <p style={{ fontSize: 11, color: S.faint, marginTop: 2 }}>點選購買</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
