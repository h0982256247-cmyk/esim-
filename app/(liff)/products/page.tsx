'use client'

import { useEffect, useMemo, useState, Suspense } from 'react'
import { useRouter, useSearchParams, useParams } from 'next/navigation'
import { useLiff } from '@/components/liff/LiffProvider'
import { GlobeIllustration, BeeLogoSVG } from '@/components/liff/LiffIllustrations'
import { useTenantColors, useTenant } from '@/components/liff/TenantContext'
import { calcBestPrice, type CouponItem } from '@/lib/utils/coupon-combo'
import { CountryFlag } from '@/components/common/CountryFlag'
import DayPicker from '@/components/liff/DayPicker'
import { useCart } from '@/components/liff/CartProvider'

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
  bg: '#f9f9f9',
  white: '#ffffff',
  ink: '#1a1a1a',
  muted: '#4b5563',
  faint: '#94a3b8',
  line: 'rgba(0,0,0,0.07)',
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
  const C = useTenantColors()
  const tenant = useTenant()
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
        {/* Logo / Icon */}
        <div style={{
          width: 76, height: 76, borderRadius: '50%',
          background: tenant?.logoUrl ? 'transparent' : '#FFF8E1',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 20, overflow: 'hidden',
        }}>
          {tenant?.logoUrl
            ? <img src={tenant.logoUrl} alt="logo" style={{ width: 76, height: 76, objectFit: 'contain', borderRadius: '50%' }} />
            : <BeeLogoSVG size={48} />
          }
        </div>

        {/* Title */}
        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1a1a1a', textAlign: 'center', margin: '0 0 8px', letterSpacing: '-0.01em' }}>
          完成個人資料綁定
        </h2>
        <p style={{ fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 1.65, margin: '0 0 20px' }}>
          填寫基本資料後，即可獲得
        </p>

        {/* Coupon reward box */}
        <div style={{
          width: '100%',
          background: '#F9F5E7',
          border: '2px dashed #92400e',
          borderRadius: 16,
          padding: '18px 20px 20px',
          marginBottom: 28,
          textAlign: 'center',
        }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#92400e', margin: '0 0 6px', letterSpacing: '0.1em' }}>
            新用戶限定
          </p>
          <p style={{ fontSize: 22, fontWeight: 900, color: '#78350f', margin: 0, letterSpacing: '0.04em' }}>
            官方 9 折優惠券
          </p>
        </div>

        {/* Primary CTA */}
        <button
          onClick={() => router.push(slug ? `/liff/${slug}/profile/setup` : '/profile/setup')}
          style={{
            width: '100%', border: 'none', borderRadius: 100,
            padding: '16px', fontSize: 16, fontWeight: 800,
            color: C.onPrimary, cursor: 'pointer',
            background: C.primary,
            letterSpacing: '0.03em',
            boxShadow: `0 4px 14px ${C.primary}44`,
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
  const C = useTenantColors()
  const tenant = useTenant()

  const [countries, setCountries] = useState<Country[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [coupons, setCoupons] = useState<CouponItem[]>([])
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
      const [prodData, couponData] = await Promise.all([
        fetch(`/api/products${params.toString() ? `?${params}` : ''}`).then(r => r.json()),
        fetch('/api/coupons').then(r => r.json()).catch(() => ({ coupons: [] })),
      ])
      setCountries(prodData.countries ?? [])
      setProducts(prodData.products ?? [])
      const now = new Date()
      setCoupons(
        (couponData.coupons ?? [])
          .filter((c: CouponItem & { usedAt?: string | null; expiresAt?: string | null }) =>
            !c.usedAt && (!c.expiresAt || new Date(c.expiresAt) > now)
          )
          .map((c: CouponItem) => ({ id: c.id, discount: c.discount }))
      )
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
          <div style={{ padding: '32px 24px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            {tenant?.logoUrl
              ? <img src={tenant.logoUrl} alt="logo" style={{ width: 110, height: 110, objectFit: 'contain' }} />
              : <GlobeIllustration size={110} />
            }
            <div style={{ textAlign: 'center' }}>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: S.ink, letterSpacing: '-0.02em', margin: 0 }}>選擇目的地</h1>
              <p style={{ fontSize: 13, color: S.faint, marginTop: 6 }}>購買出國 eSIM，即插即用</p>
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
                    boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                    transition: 'box-shadow 0.15s, transform 0.15s',
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
      </>
    )
  }

  // ── 方案選擇畫面 (Step 2) ──
  return <PlansView
    countries={countries}
    products={products}
    coupons={coupons}
    selectedCountry={selectedCountry}
    slug={slug}
    showSetup={showSetup}
    dismissSetup={dismissSetup}
    router={router}
  />
}

type PlansViewProps = {
  countries: Country[]
  products: Product[]
  coupons: CouponItem[]
  selectedCountry: string
  slug: string
  showSetup: boolean
  dismissSetup: () => void
  router: ReturnType<typeof useRouter>
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

function PlansView({ countries, products, coupons, selectedCountry, slug, showSetup, dismissSetup, router }: PlansViewProps) {
  const C = useTenantColors()
  const country = countries.find(c => c.countryCode === selectedCountry)
  const cart = useCart()

  // Compute available day options from products
  const availableDays = useMemo(() => {
    const set = new Set<number>()
    products.forEach(p => set.add(p.displayDays))
    return Array.from(set).sort((a, b) => a - b)
  }, [products])

  const minDay = availableDays[0] ?? 1
  const maxDay = availableDays[availableDays.length - 1] ?? 30

  // 0 = no filter (show all)
  const [dayFilter, setDayFilter] = useState<number>(0)
  const [pickerDays, setPickerDays] = useState<number>(0)

  // Init picker once products load
  useEffect(() => {
    if (availableDays.length > 0 && pickerDays === 0) {
      setPickerDays(availableDays[0])
    }
  }, [availableDays, pickerDays])

  const filtered = useMemo(() => {
    if (!dayFilter) return products
    return products.filter(p => p.displayDays === dayFilter)
  }, [products, dayFilter])

  // Suggest nearest day if no exact match
  const nearestDays = useMemo(() => {
    if (!dayFilter || filtered.length > 0) return []
    return [...availableDays]
      .sort((a, b) => Math.abs(a - dayFilter) - Math.abs(b - dayFilter))
      .slice(0, 3)
  }, [dayFilter, filtered.length, availableDays])

  // Compute preset chips: prefer common counts that exist in data, else fall back to defaults
  const presets = useMemo(() => {
    const common = [1, 3, 5, 7, 14, 30]
    const fromData = common.filter(n => availableDays.includes(n))
    return fromData.length >= 3 ? fromData : availableDays.slice(0, 6)
  }, [availableDays])

  const applyFilter = (n: number) => {
    setPickerDays(n)
    setDayFilter(n)
  }

  const clearFilter = () => {
    setDayFilter(0)
  }

  return (
    <>
      {showSetup && <SetupModal slug={slug} onDismiss={dismissSetup} />}
      <div style={{ maxWidth: 520, margin: '0 auto', paddingBottom: 96 }}>
        {/* Sticky header */}
        <div style={{
          position: 'sticky', top: 0,
          background: 'rgba(249,249,249,0.96)',
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
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {country && <CountryFlag code={country.countryCode} fallbackEmoji={country.countryFlag} size={22} />}
              <h1 style={{ fontSize: 17, fontWeight: 700, color: S.ink, margin: 0 }}>{country?.countryNameZh ?? '方案'}</h1>
            </div>
            <p style={{ fontSize: 12, color: S.faint, margin: 0 }}>
              {dayFilter ? `${filtered.length} / ${products.length} 個方案` : `${products.length} 個方案`}
            </p>
          </div>
          {dayFilter > 0 && (
            <button
              type="button"
              onClick={clearFilter}
              style={{
                background: 'transparent',
                border: `1px solid ${S.line}`,
                color: S.muted,
                fontSize: 12,
                fontWeight: 600,
                padding: '6px 10px',
                borderRadius: 100,
                cursor: 'pointer',
              }}
            >顯示全部</button>
          )}
        </div>

        {/* Day picker filter */}
        {availableDays.length > 0 && (
          <div style={{ padding: '14px 16px 4px' }}>
            <DayPicker
              value={pickerDays || availableDays[0]}
              onChange={applyFilter}
              min={minDay}
              max={maxDay}
              presets={presets}
              label="想用幾天？"
              caption={dayFilter
                ? (filtered.length > 0 ? `找到 ${filtered.length} 個 ${dayFilter} 天方案` : `沒有 ${dayFilter} 天的方案`)
                : '選擇天數即可篩選方案'}
            />
          </div>
        )}

        {/* Plans */}
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {products.length === 0 && (
            <p style={{ textAlign: 'center', color: S.faint, padding: '48px 0', fontSize: 14 }}>此目的地暫無可購買方案</p>
          )}

          {dayFilter > 0 && filtered.length === 0 && nearestDays.length > 0 && (
            <div style={{ padding: '8px 4px' }}>
              <p style={{ fontSize: 13, color: S.muted, margin: '0 0 8px' }}>
                您也可以選擇相近天數：
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {nearestDays.map(n => (
                  <button
                    key={n}
                    onClick={() => applyFilter(n)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 100,
                      border: `1px solid ${C.border}`,
                      background: C.light,
                      color: C.primary,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >{n} 天</button>
                ))}
              </div>
            </div>
          )}

          {filtered.map(p => {
            const inCart = cart.has(p.id)
            return (
              <div
                key={p.id}
                style={{
                  width: '100%',
                  background: S.white,
                  borderRadius: 14,
                  border: `1px solid ${inCart ? C.border : S.line}`,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                  display: 'flex',
                  alignItems: 'stretch',
                  gap: 0,
                  overflow: 'hidden',
                }}
              >
                <button
                  type="button"
                  onClick={() => router.push(`/products/${p.id}`)}
                  style={{
                    flex: 1,
                    textAlign: 'left',
                    background: 'transparent',
                    border: 'none',
                    padding: '16px 16px 16px 18px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    WebkitTapHighlightColor: 'transparent',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
                      <span style={{ fontSize: 22, fontWeight: 800, color: S.ink, letterSpacing: '-0.02em' }}>{p.displayDays}</span>
                      <span style={{ fontSize: 13, color: S.muted, fontWeight: 500 }}>天</span>
                    </div>
                    {p.dataCapacity && (
                      <span style={{
                        display: 'inline-block',
                        fontSize: 12, fontWeight: 600, color: S.muted,
                        background: '#f3f4f6', borderRadius: 6, padding: '2px 8px',
                        marginBottom: 4,
                      }}>
                        {p.dataCapacity}
                      </span>
                    )}
                    {p.description && (
                      <p style={{ fontSize: 12, color: S.faint, margin: 0, display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {p.description}
                      </p>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    {(() => {
                      const { bestPrice, savedAmount, hasDiscount } = calcBestPrice(coupons, p.sellPrice)
                      return hasDiscount ? (
                        <>
                          <p style={{ fontSize: 12, color: S.faint, margin: 0, textDecoration: 'line-through' }}>
                            NT${p.sellPrice.toLocaleString()}
                          </p>
                          <p style={{ fontSize: 22, fontWeight: 800, color: C.primary, margin: 0, letterSpacing: '-0.02em' }}>
                            NT${bestPrice.toLocaleString()}
                          </p>
                          <p style={{ fontSize: 11, color: '#16a34a', marginTop: 1, fontWeight: 600 }}>
                            省 NT${savedAmount.toLocaleString()}
                          </p>
                        </>
                      ) : (
                        <p style={{ fontSize: 22, fontWeight: 800, color: C.primary, margin: 0, letterSpacing: '-0.02em' }}>
                          NT${p.sellPrice.toLocaleString()}
                        </p>
                      )
                    })()}
                  </div>
                </button>

                {/* Add-to-cart side button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (inCart) {
                      cart.remove(p.id)
                    } else {
                      cart.add({
                        productId: p.id,
                        countryCode: p.countryCode,
                        countryNameZh: p.countryNameZh,
                        countryFlag: country?.countryFlag ?? null,
                        displayDays: p.displayDays,
                        dataCapacity: p.dataCapacity,
                        sellPrice: p.sellPrice,
                      })
                    }
                  }}
                  aria-label={inCart ? '從購物車移除' : '加入購物車'}
                  style={{
                    width: 52,
                    flexShrink: 0,
                    background: inCart ? C.primary : C.light,
                    color: inCart ? C.onPrimary : C.primary,
                    border: 'none',
                    borderLeft: `1px solid ${inCart ? 'transparent' : S.line}`,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
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
    </>
  )
}
