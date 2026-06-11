'use client'

import { useEffect, useMemo, useState, Suspense } from 'react'
import { useRouter, useSearchParams, useParams } from 'next/navigation'
import { useLiff } from '@/components/liff/LiffProvider'
import { useTenantColors, useTenant } from '@/components/liff/TenantContext'
import { type CouponItem } from '@/lib/utils/coupon-combo'
import { GlobeIllustration } from '@/components/liff/LiffIllustrations'
import { PRODUCTS_TEMPLATES } from '@/components/liff/templates/registry'
import SetupModal from '@/components/liff/SetupModal'
import { useCart } from '@/components/liff/CartProvider'
import type { Country, Product, DayFilterControls, CartControls } from '@/components/liff/templates/products/types'

const COMMON_PRESETS = [1, 3, 5, 7, 14, 30]

function Spinner() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', gap: 16 }}>
      <GlobeIllustration size={80} />
      <p style={{ fontSize: 13, color: '#94a3b8', letterSpacing: '0.04em' }}>載入中</p>
    </div>
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
  const params = useParams<{ slug?: string }>()
  const slug = params?.slug ?? ''
  const selectedCountry = searchParams.get('country')
  const showSetup = searchParams.get('setup') === '1'
  const { liff, isReady } = useLiff()
  const C = useTenantColors()
  const tenant = useTenant()
  const cart = useCart()

  const [countries, setCountries] = useState<Country[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [coupons, setCoupons] = useState<CouponItem[]>([])
  const [loading, setLoading] = useState(true)

  // Day filter state
  const [dayFilter, setDayFilter] = useState<number>(0)  // 0 = inactive
  const [pickerDays, setPickerDays] = useState<number>(1)

  // Reset filter when country changes
  useEffect(() => {
    setDayFilter(0)
    setPickerDays(1)
  }, [selectedCountry])

  function dismissSetup() {
    const next = new URLSearchParams(searchParams.toString())
    next.delete('setup')
    const qs = next.toString()
    router.replace(qs ? `?${qs}` : `/liff/${slug}/products`)
  }

  useEffect(() => {
    if (!isReady) return
    async function load() {
      let lineUid: string | undefined
      try { if (liff) lineUid = (await liff.getProfile()).userId } catch {}
      const qs = new URLSearchParams()
      if (selectedCountry) qs.set('country', selectedCountry)
      if (lineUid) qs.set('lineUid', lineUid)
      const [prodData, couponData] = await Promise.all([
        fetch(`/api/products${qs.toString() ? `?${qs}` : ''}`).then(r => r.json()),
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

  const availableDays = useMemo(() => {
    const set = new Set<number>()
    products.forEach(p => set.add(p.displayDays))
    return Array.from(set).sort((a, b) => a - b)
  }, [products])

  // Initialize picker default to first available day after products load
  useEffect(() => {
    if (availableDays.length > 0 && (pickerDays === 1 || !availableDays.includes(pickerDays))) {
      setPickerDays(availableDays[0])
    }
  }, [availableDays, pickerDays])

  const filteredProducts = useMemo(() => {
    if (!dayFilter) return products
    return products.filter(p => p.displayDays === dayFilter)
  }, [products, dayFilter])

  const nearestDays = useMemo(() => {
    if (!dayFilter || filteredProducts.length > 0) return []
    return [...availableDays]
      .sort((a, b) => Math.abs(a - dayFilter) - Math.abs(b - dayFilter))
      .slice(0, 3)
  }, [dayFilter, filteredProducts.length, availableDays])

  const presets = useMemo(() => {
    const fromData = COMMON_PRESETS.filter(n => availableDays.includes(n))
    return fromData.length >= 3 ? fromData : availableDays.slice(0, 6)
  }, [availableDays])

  const filter: DayFilterControls = useMemo(() => ({
    pickerDays: pickerDays || (availableDays[0] ?? 1),
    dayFilter,
    availableDays,
    presets,
    minDay: availableDays[0] ?? 1,
    maxDay: availableDays[availableDays.length - 1] ?? 30,
    onChange: (n: number) => { setPickerDays(n); setDayFilter(n) },
    onClear: () => setDayFilter(0),
    filteredCount: filteredProducts.length,
    totalCount: products.length,
    nearestDays,
  }), [pickerDays, dayFilter, availableDays, presets, filteredProducts.length, products.length, nearestDays])

  const cartControls: CartControls = useMemo(() => ({
    has: (id: string) => cart.has(id),
    toggle: (product: Product) => {
      if (cart.has(product.id)) {
        cart.remove(product.id)
        return
      }
      const country = countries.find(c => c.countryCode === product.countryCode)
      cart.add({
        productId: product.id,
        countryCode: product.countryCode,
        countryNameZh: product.countryNameZh,
        countryFlag: country?.countryFlag ?? null,
        displayDays: product.displayDays,
        dataCapacity: product.dataCapacity,
        sellPrice: product.sellPrice,
      })
    },
  }), [cart, countries])

  if (loading) return <Spinner />

  const templateKey = tenant?.productsTemplate ?? 'classic'
  const Template = PRODUCTS_TEMPLATES[templateKey]

  return (
    <>
      {showSetup && <SetupModal slug={slug} onDismiss={dismissSetup} colors={C} logoUrl={tenant?.logoUrl ?? null} />}
      <Template
        slug={slug}
        countries={countries}
        products={filteredProducts}
        coupons={coupons}
        selectedCountry={selectedCountry}
        showSetup={showSetup}
        colors={C}
        logoUrl={tenant?.logoUrl ?? null}
        onSelectCountry={code => router.push(`/liff/${slug}/products?country=${code}`)}
        onSelectProduct={id => router.push(`/liff/${slug}/products/${id}`)}
        onBack={() => router.push(`/liff/${slug}/products`)}
        onDismissSetup={dismissSetup}
        filter={filter}
        cart={cartControls}
      />
    </>
  )
}
