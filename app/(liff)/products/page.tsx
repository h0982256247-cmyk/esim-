'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams, useParams } from 'next/navigation'
import { useLiff } from '@/components/liff/LiffProvider'
import { GlobeIllustration, BeeLogoSVG } from '@/components/liff/LiffIllustrations'
import { usePrimaryColor } from '@/components/liff/TenantContext'

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

function SetupModal({ slug, onDismiss }: { slug: string; onDismiss: () => void }) {
  const primaryColor = usePrimaryColor()
  const router = useRouter()
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(15,23,42,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '0 24px',
      animation: 'smFadeIn 0.2s ease',
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 24,
        padding: '36px 24px 28px',
        width: '100%',
        maxWidth: 360,
        boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
        animation: 'smScaleIn 0.28s cubic-bezier(0.34,1.56,0.64,1)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
      }}>
        {/* Icon */}
        <div style={{
          width: 76, height: 76, borderRadius: '50%',
          background: '#FFF8E1',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 20,
        }}>
          <BeeLogoSVG size={48} />
        </div>

        {/* Title */}
        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', textAlign: 'center', margin: '0 0 8px', letterSpacing: '-0.01em' }}>
          完成個人資料綁定
        </h2>
        <p style={{ fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 1.65, margin: '0 0 20px' }}>
          填寫基本資料後，即可獲得
        </p>

        {/* Coupon reward box */}
        <div style={{
          width: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          background: '#FFFBEB', border: '1.5px dashed #F59E0B',
          borderRadius: 14, padding: '13px 20px', marginBottom: 28,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
            <line x1="7" y1="7" x2="7.01" y2="7"/>
          </svg>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#92400e', letterSpacing: '0.02em' }}>官方 9 折優惠券 × 1</span>
        </div>

        {/* Primary CTA */}
        <button
          onClick={() => router.push(slug ? `/liff/${slug}/profile/setup` : '/profile/setup')}
          style={{
            width: '100%', border: 'none', borderRadius: 16,
            padding: '16px', fontSize: 16, fontWeight: 800,
            color: '#fff', cursor: 'pointer',
            background: primaryColor,
            letterSpacing: '0.03em',
            boxShadow: `0 4px 14px ${primaryColor}44`,
            marginBottom: 4,
          }}
        >
          前往綁定
        </button>

        {/* Skip */}
        <button
          onClick={onDismiss}
          style={{
            width: '100%', background: 'none', border: 'none',
            padding: '11px', fontSize: 13, color: '#94a3b8',
            cursor: 'pointer', letterSpacing: '0.02em',
          }}
        >
          稍後再說
        </button>
      </div>
      <style>{`
        @keyframes smFadeIn { from{opacity:0} to{opacity:1} }
        @keyframes smScaleIn { from{opacity:0;transform:scale(0.88)} to{opacity:1;transform:scale(1)} }
      `}</style>
    </div>
  )
}

function ProductsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const params = useParams<{ slug?: string }>()
  const slug = params?.slug ?? ''
  const selectedCountry = searchParams.get('country')
  const showSetup = searchParams.get('setup') === '1'
  const { liff, isReady } = useLiff()

  const [countries, setCountries] = useState<Country[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  function dismissSetup() {
    const next = new URLSearchParams(searchParams.toString())
    next.delete('setup')
    const qs = next.toString()
    router.replace(qs ? `?${qs}` : (slug ? `/liff/${slug}/products` : '/products'))
  }

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
      <>
        {showSetup && <SetupModal slug={slug} onDismiss={dismissSetup} />}
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
      </>
    )
  }

  // ── 方案選擇畫面 (Step 2) ──
  const country = countries.find(c => c.countryCode === selectedCountry)

  return (
    <>
      {showSetup && <SetupModal slug={slug} onDismiss={dismissSetup} />}
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
    </>
  )
}
