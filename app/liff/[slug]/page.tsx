'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useLiff } from '@/components/liff/LiffProvider'
import { useTenant, useTenantColors } from '@/components/liff/TenantContext'
import { HOME_TEMPLATES } from '@/components/liff/templates/registry'
import SetupModal from '@/components/liff/SetupModal'
import { BeeLogoSVG } from '@/components/liff/LiffIllustrations'
import type { HomeCountry } from '@/components/liff/templates/home/types'

type Product = { countryCode: string; sellPrice: number }

export default function LiffHomePage() {
  const { isReady, error } = useLiff()
  const router = useRouter()
  const params = useParams()
  const slug = params.slug as string
  const tenant = useTenant()
  const C = useTenantColors()

  const [countries, setCountries] = useState<HomeCountry[]>([])
  const [showSetup, setShowSetup] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [splashOut, setSplashOut] = useState(false)

  const brandName = tenant?.brandName ?? 'eSIM'
  const primary = tenant?.primaryColor ?? '#0284c7'

  useEffect(() => {
    if (!isReady) return
    async function init() {
      try {
        const me = await fetch('/api/auth/me').then(r => r.ok ? r.json() : null)
        if (me && !me.profileComplete) setShowSetup(true)
      } catch {}

      try {
        const data = await fetch('/api/products').then(r => r.json())
        const products: Product[] = data.products ?? []
        const minPriceMap: Record<string, number> = {}
        for (const p of products) {
          if (!minPriceMap[p.countryCode] || p.sellPrice < minPriceMap[p.countryCode]) {
            minPriceMap[p.countryCode] = p.sellPrice
          }
        }
        setCountries((data.countries ?? []).map((c: HomeCountry) => ({
          ...c, minPrice: minPriceMap[c.countryCode] ?? null,
        })))
      } catch {}

      // 最少顯示 splash 0.6s，fade-out 需要 0.35s
      setTimeout(() => {
        setSplashOut(true)
        setTimeout(() => setLoaded(true), 350)
      }, 600)
    }
    init()
  }, [isReady])

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

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 24 }}>
        <p style={{ color: '#ef4444', fontSize: 14, textAlign: 'center' }}>{error}</p>
      </div>
    )
  }

  return (
    <>
      {/* ── Splash 過場 ── */}
      {!loaded && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: '#fff',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 20,
          transition: 'opacity 0.35s ease',
          opacity: splashOut ? 0 : 1,
          pointerEvents: splashOut ? 'none' : 'auto',
        }}>
          {/* 旋轉圓環 */}
          <div style={{ position: 'relative', width: 100, height: 100 }}>
            <svg width="100" height="100" style={{ position: 'absolute', inset: 0, animation: 'spinRing 2.5s linear infinite' }}>
              <circle cx="50" cy="50" r="44" fill="none" stroke={primary} strokeWidth="2" strokeDasharray="60 220" strokeLinecap="round" opacity="0.5"/>
            </svg>
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {tenant?.logoUrl
                ? <img src={tenant.logoUrl} alt={brandName} style={{ width: 56, height: 56, objectFit: 'contain', borderRadius: 14 }} />
                : <BeeLogoSVG size={52} />
              }
            </div>
          </div>

          {/* 品牌名 */}
          <div style={{ textAlign: 'center', animation: 'fadeUp 0.5s 0.1s ease both' }}>
            <p style={{ fontSize: 24, fontWeight: 900, color: '#1a1a1a', margin: 0, letterSpacing: '-0.02em' }}>{brandName}</p>
            <p style={{ fontSize: 12, color: '#9ca3af', margin: '6px 0 0', letterSpacing: '0.1em' }}>旅遊 eSIM 專門店</p>
          </div>

          {/* 載入點點 */}
          <div style={{ display: 'flex', gap: 6 }}>
            {[0,1,2].map(i => (
              <div key={i} style={{
                width: 6, height: 6, borderRadius: '50%',
                background: primary,
                animation: `dotPulse 1.2s ease-in-out ${i * 0.2}s infinite`,
              }}/>
            ))}
          </div>

          <style>{`
            @keyframes spinRing  { to{transform:rotate(360deg)} }
            @keyframes fadeUp    { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
            @keyframes dotPulse  { 0%,80%,100%{transform:scale(0.6);opacity:0.35} 40%{transform:scale(1.3);opacity:1} }
          `}</style>
        </div>
      )}

      {/* ── 首頁內容 ── */}
      {loaded && (
        <>
          {showSetup && (
            <SetupModal slug={slug} onDismiss={() => setShowSetup(false)} colors={C} logoUrl={tenant?.logoUrl ?? null} />
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
            onSearch={q => router.push(`/liff/${slug}/products${q}`)}
          />
        </>
      )}
    </>
  )
}
