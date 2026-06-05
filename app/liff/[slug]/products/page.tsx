'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams, useParams } from 'next/navigation'
import { useLiff } from '@/components/liff/LiffProvider'
import { useTenantColors, useTenant } from '@/components/liff/TenantContext'
import { calcBestPrice, type CouponItem } from '@/lib/utils/coupon-combo'
import { GlobeIllustration } from '@/components/liff/LiffIllustrations'
import { PRODUCTS_TEMPLATES } from '@/components/liff/templates/registry'
import SetupModal from '@/components/liff/SetupModal'
import type { Country, Product } from '@/components/liff/templates/products/types'

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

  const [countries, setCountries] = useState<Country[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [coupons, setCoupons] = useState<CouponItem[]>([])
  const [loading, setLoading] = useState(true)

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

  if (loading) return <Spinner />

  const templateKey = tenant?.productsTemplate ?? 'classic'
  const Template = PRODUCTS_TEMPLATES[templateKey]

  return (
    <>
      {showSetup && <SetupModal slug={slug} onDismiss={dismissSetup} colors={C} logoUrl={tenant?.logoUrl ?? null} />}
      <Template
        slug={slug}
        countries={countries}
        products={products}
        coupons={coupons}
        selectedCountry={selectedCountry}
        showSetup={showSetup}
        colors={C}
        logoUrl={tenant?.logoUrl ?? null}
        onSelectCountry={code => router.push(`/liff/${slug}/products?country=${code}`)}
        onSelectProduct={id => router.push(`/liff/${slug}/products/${id}`)}
        onBack={() => router.push(`/liff/${slug}/products`)}
        onDismissSetup={dismissSetup}
      />
    </>
  )
}
