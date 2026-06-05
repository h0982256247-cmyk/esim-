'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useLiff } from '@/components/liff/LiffProvider'
import { useTenant, useTenantColors } from '@/components/liff/TenantContext'
import { HOME_TEMPLATES } from '@/components/liff/templates/registry'
import SetupModal from '@/components/liff/SetupModal'
import type { HomeCountry } from '@/components/liff/templates/home/types'

type Product = { countryCode: string; sellPrice: number }

export default function LiffHomePage() {
  const { isReady, error, liff } = useLiff()
  const router = useRouter()
  const params = useParams()
  const slug = params.slug as string
  const tenant = useTenant()
  const C = useTenantColors()

  const [countries, setCountries] = useState<HomeCountry[]>([])
  const [showSetup, setShowSetup] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!isReady) return
    async function init() {
      // 1. check profile
      try {
        const me = await fetch('/api/auth/me').then(r => r.ok ? r.json() : null)
        if (me && !me.profileComplete) setShowSetup(true)
      } catch {}

      // 2. fetch countries + compute min prices
      try {
        const data = await fetch('/api/products').then(r => r.json())
        const products: Product[] = data.products ?? []
        const minPriceMap: Record<string, number> = {}
        for (const p of products) {
          if (!minPriceMap[p.countryCode] || p.sellPrice < minPriceMap[p.countryCode]) {
            minPriceMap[p.countryCode] = p.sellPrice
          }
        }
        setCountries(
          (data.countries ?? []).map((c: HomeCountry) => ({
            ...c,
            minPrice: minPriceMap[c.countryCode] ?? null,
          }))
        )
      } catch {}

      setLoaded(true)
    }
    init()
  }, [isReady])

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 24 }}>
        <p style={{ color: '#ef4444', fontSize: 14, textAlign: 'center' }}>{error}</p>
      </div>
    )
  }

  // 首次載入 skeleton
  if (!loaded) {
    return (
      <div style={{ minHeight: '100vh', background: '#fff', display: 'flex', flexDirection: 'column', gap: 0 }}>
        {/* header skeleton */}
        <div style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #f3f4f6' }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: '#f3f4f6', animation: 'shimmer 1.2s ease infinite alternate' }}/>
          <div style={{ width: 100, height: 16, borderRadius: 8, background: '#f3f4f6', animation: 'shimmer 1.2s ease infinite alternate' }}/>
        </div>
        {/* search skeleton */}
        <div style={{ padding: '16px' }}>
          <div style={{ height: 46, borderRadius: 16, background: '#f3f4f6', animation: 'shimmer 1.2s ease infinite alternate' }}/>
        </div>
        {/* grid skeleton */}
        <div style={{ padding: '0 16px', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{ height: 72, borderRadius: 14, background: '#f3f4f6', animation: `shimmer 1.2s ${i*0.1}s ease infinite alternate` }}/>
          ))}
        </div>
        <style>{`@keyframes shimmer{from{opacity:0.5}to{opacity:1}}`}</style>
      </div>
    )
  }

  const templateKey = tenant?.homeTemplate ?? 'landmark'
  const HomeTemplate = HOME_TEMPLATES[templateKey]

  function handleNavigate(path: string) {
    const routes: Record<string, string> = {
      orders:  `/liff/${slug}/orders`,
      products:`/liff/${slug}/products`,
      profile: `/liff/${slug}/profile`,
      guide:   `/liff/${slug}/support`,
      data:    `/liff/${slug}/support`,
      devices: `/liff/${slug}/support`,
    }
    router.push(routes[path] ?? `/liff/${slug}/${path}`)
  }

  return (
    <>
      {showSetup && (
        <SetupModal
          slug={slug}
          onDismiss={() => setShowSetup(false)}
          colors={C}
          logoUrl={tenant?.logoUrl ?? null}
        />
      )}
      <HomeTemplate
        tenant={tenant}
        slug={slug}
        countries={countries}
        colors={C}
        showSetup={showSetup}
        onDismissSetup={() => setShowSetup(false)}
        onSelectCountry={code => router.push(`/liff/${slug}/products?country=${code}`)}
        onNavigate={handleNavigate}
        onSearch={q => router.push(`/liff/${slug}/products?q=${encodeURIComponent(q)}`)}
      />
    </>
  )
}
