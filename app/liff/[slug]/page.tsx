'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useLiff } from '@/components/liff/LiffProvider'
import { useTenant, useTenantColors } from '@/components/liff/TenantContext'
import { HOME_TEMPLATES } from '@/components/liff/templates/registry'
import SetupModal from '@/components/liff/SetupModal'
import { BeeLogoSVG } from '@/components/liff/LiffIllustrations'
import { hasSeenSplash, markSplashSeen } from '@/lib/utils/splash'
import { setCache, productsCacheKey } from '@/hooks/useCachedData'
import type { HomeCountry } from '@/components/liff/templates/home/types'

type Product = { countryCode: string; sellPrice: number }

export default function LiffHomePage() {
  const { isReady, error } = useLiff()
  const router = useRouter()
  const params = useParams()
  const slug = params.slug as string
  const tenant = useTenant()
  const C = useTenantColors()

  const brandName = tenant?.brandName ?? 'eSIM'
  const primary   = tenant?.primaryColor ?? '#0284c7'

  // ── 過場：只有「本次 session 第一次」進入才播放 ──
  // 用 sessionStorage 記錄已看過；之後在 App 內回到主頁直接略過過場，
  // 只有重新點擊網址（開新分頁／新 session）才會再看到。
  // 用 lazy initializer 同步讀取，避免回訪時閃一下白色過場畫面。
  const [splashOut, setSplashOut] = useState(false)
  const [splashDone, setSplashDone] = useState<boolean>(hasSeenSplash)

  useEffect(() => {
    if (splashDone) return  // 本 session 已看過 → 不再播放
    markSplashSeen()
    const t1 = setTimeout(() => setSplashOut(true), 700)
    const t2 = setTimeout(() => setSplashDone(true), 1060)  // 700 + 360 fade
    return () => { clearTimeout(t1); clearTimeout(t2) }
    // 僅在首次 mount 評估一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── 資料抓取 ──
  const [countries, setCountries] = useState<HomeCountry[]>([])
  const [showSetup, setShowSetup] = useState(false)

  useEffect(() => {
    if (!isReady) return
    async function fetchData() {
      try {
        const me = await fetch('/api/auth/me').then(r => r.ok ? r.json() : null)
        // profileComplete 在 me.user 底下（過去誤讀 me.profileComplete → 永遠 undefined
        // → 對已填資料的人也彈設定視窗）
        if (me?.user && !me.user.profileComplete) setShowSetup(true)
      } catch {}
      try {
        const data = await fetch('/api/products').then(r => r.json())
        // 寫入跨頁共用 cache，slug products 頁掛載時可直接吃這份、不必再打 API
        setCache(productsCacheKey(), data)
        const products: Product[] = data.products ?? []
        const minMap: Record<string, number> = {}
        for (const p of products) {
          if (!minMap[p.countryCode] || p.sellPrice < minMap[p.countryCode]) minMap[p.countryCode] = p.sellPrice
        }
        setCountries((data.countries ?? []).map((c: HomeCountry) => ({ ...c, minPrice: minMap[c.countryCode] ?? null })))
      } catch {}
    }
    fetchData()
  }, [isReady])

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

  const templateKey = tenant?.homeTemplate ?? 'landmark'
  const HomeTemplate = HOME_TEMPLATES[templateKey]

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 24 }}>
        <p style={{ color: '#ef4444', fontSize: 14, textAlign: 'center' }}>{error}</p>
      </div>
    )
  }

  return (
    <>
      {/* ── 過場 Splash（每次 mount 都出現）── */}
      {!splashDone && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: '#ffffff',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20,
          transition: 'opacity 0.36s ease',
          opacity: splashOut ? 0 : 1,
          pointerEvents: splashOut ? 'none' : 'auto',
        }}>
          {/* 旋轉圓環 + Logo */}
          <div style={{ position: 'relative', width: 100, height: 100 }}>
            <svg width="100" height="100" style={{ position: 'absolute', inset: 0, animation: 'spinRing 2s linear infinite' }}>
              <circle cx="50" cy="50" r="44" fill="none" stroke={primary} strokeWidth="2.5"
                strokeDasharray="55 221" strokeLinecap="round" opacity="0.6"/>
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {tenant?.logoUrl
                ? <img src={tenant.logoUrl} alt={brandName} style={{ width: 60, height: 60, objectFit: 'contain', borderRadius: 16 }} />
                : <BeeLogoSVG size={54} />
              }
            </div>
          </div>

          {/* 品牌名 */}
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 24, fontWeight: 900, color: '#1a1a1a', margin: 0, letterSpacing: '-0.02em' }}>{brandName}</p>
            <p style={{ fontSize: 12, color: '#9ca3af', margin: '6px 0 0', letterSpacing: '0.1em' }}>旅遊 eSIM 專門店</p>
          </div>

          {/* 跳動點 */}
          <div style={{ display: 'flex', gap: 6 }}>
            {[0,1,2].map(i => (
              <div key={i} style={{
                width: 6, height: 6, borderRadius: '50%', background: primary,
                animation: `dotPulse 1.2s ease-in-out ${i * 0.2}s infinite`,
              }}/>
            ))}
          </div>

          <style>{`
            @keyframes spinRing { to{transform:rotate(360deg)} }
            @keyframes dotPulse { 0%,80%,100%{transform:scale(0.6);opacity:0.35} 40%{transform:scale(1.3);opacity:1} }
          `}</style>
        </div>
      )}

      {/* ── 首頁主體（過場進行中也在背景渲染）── */}
      <div style={{ opacity: splashDone ? 1 : 0, transition: 'opacity 0.3s ease' }}>
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
      </div>
    </>
  )
}
