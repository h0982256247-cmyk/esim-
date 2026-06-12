'use client'

import { useEffect, useMemo, useState, Suspense } from 'react'
import { useRouter, useSearchParams, useParams } from 'next/navigation'
import { useLiff } from '@/components/liff/LiffProvider'
import { useTenantColors, useTenant } from '@/components/liff/TenantContext'
import { type CouponItem } from '@/lib/utils/coupon-combo'
import { pickInitialDay } from '@/lib/utils/products-day-default'
import { peekCache, setCache, productsCacheKey } from '@/hooks/useCachedData'

type ProductsApiResponse = { countries?: Country[]; products?: Product[] }
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
  // allProducts = 後端抓回的「所有方案」；selectedCountry/dayFilter 在前端篩選，避免切國家時重打 API
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [coupons, setCoupons] = useState<CouponItem[]>([])
  const [loading, setLoading] = useState(true)

  // Day filter state — 預設一律以 5 天為起點（無 5 天方案則 effect 內 fallback）
  const [dayFilter, setDayFilter] = useState<number>(0)  // 0 = inactive，effect 內套用
  const [pickerDays, setPickerDays] = useState<number>(0) // 0 = 待初始化

  // Reset filter when country changes，讓初始化 effect 重新依新國家挑 5（或最近值）
  useEffect(() => {
    setDayFilter(0)
    setPickerDays(0)
  }, [selectedCountry])

  function dismissSetup() {
    const next = new URLSearchParams(searchParams.toString())
    next.delete('setup')
    const qs = next.toString()
    router.replace(qs ? `?${qs}` : `/liff/${slug}/products`)
  }

  // 初次 ready 時抓資料，後續切國家純前端 filter；
  // 跨頁共用 cache 已有 hit（主頁預熱寫入）就先 setState 立即顯示，背景刷新拿最新
  useEffect(() => {
    if (!isReady) return
    let cancelled = false

    const cached = peekCache<ProductsApiResponse>(productsCacheKey())
    if (cached) {
      setCountries(cached.countries ?? [])
      setAllProducts(cached.products ?? [])
      setLoading(false)
    }

    async function load() {
      const [prodData, couponData] = await Promise.all([
        fetch('/api/products').then(r => r.json()),
        fetch('/api/coupons').then(r => r.json()).catch(() => ({ coupons: [] })),
      ])
      if (cancelled) return
      // 拿到最新 → 同時更新狀態與快取（用 setCache 強制覆蓋，prefetchCache 會跳過已存在的 key）
      setCache(productsCacheKey(), prodData)
      setCountries(prodData.countries ?? [])
      setAllProducts(prodData.products ?? [])
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
    return () => { cancelled = true }
  }, [isReady])

  // 依 selectedCountry 在前端 filter — 切國家瞬間完成、不需 API roundtrip
  const products = useMemo(
    () => selectedCountry ? allProducts.filter(p => p.countryCode === selectedCountry) : allProducts,
    [allProducts, selectedCountry],
  )

  const availableDays = useMemo(() => {
    const set = new Set<number>()
    products.forEach(p => set.add(p.displayDays))
    return Array.from(set).sort((a, b) => a - b)
  }, [products])

  // Initialize picker once products load — see pickInitialDay (預設 5、fallback 最近值)
  useEffect(() => {
    if (pickerDays !== 0) return
    const chosen = pickInitialDay(availableDays)
    if (chosen !== null) {
      setPickerDays(chosen)
      setDayFilter(chosen)
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
        networkType: product.networkType,
        isNativeSim: product.isNativeSim,
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
