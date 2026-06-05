'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLiff } from '@/components/liff/LiffProvider'
import { BeeLogoSVG } from '@/components/liff/LiffIllustrations'

type Phase = 'splash' | 'modal' | 'redirecting'

export default function LiffHome() {
  const { isReady, error } = useLiff()
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('splash')
  const [splashOut, setSplashOut] = useState(false)
  const [profileComplete, setProfileComplete] = useState<boolean | null>(null)

  // 1. 進場後即開始 fetch 資料
  useEffect(() => {
    if (!isReady) return

    async function checkProfile() {
      const res = await fetch('/api/auth/me')
      if (!res.ok) return
      const data = await res.json()
      setProfileComplete(!!data.profileComplete)
    }

    checkProfile()
  }, [isReady])

  // 2. 過場邏輯：最少顯示 0.5s
  useEffect(() => {
    if (profileComplete === null) return

    const splashTimer = setTimeout(() => {
      setSplashOut(true)
      setTimeout(() => {
        if (profileComplete) {
          setPhase('redirecting')
          router.replace('/products')
        } else {
          setPhase('modal')
        }
      }, 350) // fade-out 時間
    }, 500)

    return () => clearTimeout(splashTimer)
  }, [profileComplete, router])

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 24 }}>
        <p style={{ color: '#ef4444', fontSize: 14, textAlign: 'center' }}>{error}</p>
      </div>
    )
  }

  return (
    <>
      {/* ── 過場畫面 ── */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: '#FFC107',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 20,
        transition: 'opacity 0.35s ease, transform 0.35s ease',
        opacity: splashOut ? 0 : 1,
        transform: splashOut ? 'scale(1.04)' : 'scale(1)',
        pointerEvents: splashOut ? 'none' : 'auto',
      }}>
        {/* Bee logo */}
        <div style={{ animation: 'beeFloat 1.8s ease-in-out infinite' }}>
          <BeeLogoSVG size={100} />
        </div>

        {/* Brand name */}
        <div style={{ textAlign: 'center' }}>
          <p style={{
            fontSize: 36, fontWeight: 900, color: '#1F1F1F',
            letterSpacing: '-0.02em', lineHeight: 1,
            fontFamily: '"Noto Sans TC", "PingFang TC", sans-serif',
          }}>
            Bee<span style={{ color: '#1F1F1F' }}>旅</span>
          </p>
          <p style={{ fontSize: 13, color: 'rgba(31,31,31,0.6)', marginTop: 8, letterSpacing: '0.1em' }}>
            加入旅遊社群 · 領取專屬優惠
          </p>
        </div>

        {/* Decorative dots */}
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: 6, height: 6, borderRadius: '50%',
              background: 'rgba(31,31,31,0.3)',
              animation: `dotBounce 1s ease-in-out ${i * 0.15}s infinite`,
            }} />
          ))}
        </div>

        <style>{`
          @keyframes beeFloat {
            0%, 100% { transform: translateY(0px) rotate(-2deg); }
            50%       { transform: translateY(-8px) rotate(2deg); }
          }
          @keyframes dotBounce {
            0%, 80%, 100% { transform: scale(1); opacity: 0.3; }
            40%           { transform: scale(1.4); opacity: 1; }
          }
        `}</style>
      </div>

      {/* ── 個資綁定彈出視窗 ── */}
      {phase === 'modal' && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 90,
          background: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          animation: 'fadeIn 0.25s ease',
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '24px 24px 0 0',
            padding: '28px 24px 40px',
            width: '100%',
            maxWidth: 520,
            animation: 'slideUp 0.3s cubic-bezier(0.34,1.56,0.64,1)',
          }}>
            {/* Handle bar */}
            <div style={{ width: 40, height: 4, background: '#e2e8f0', borderRadius: 100, margin: '0 auto 24px' }} />

            {/* Icon */}
            <div style={{
              width: 72, height: 72,
              background: '#FFF8E1',
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
            }}>
              <BeeLogoSVG size={48} />
            </div>

            {/* Text */}
            <h2 style={{
              fontSize: 20, fontWeight: 800, color: '#1F1F1F',
              textAlign: 'center', margin: '0 0 10px',
              fontFamily: '"Noto Sans TC", "PingFang TC", sans-serif',
            }}>
              完成個人資料綁定
            </h2>
            <p style={{ fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 1.7, margin: '0 0 8px' }}>
              填寫基本資料後，即可獲得
            </p>

            {/* Coupon highlight */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              background: '#FFF8E1', border: '1.5px dashed #FFC107',
              borderRadius: 12, padding: '12px 20px', margin: '0 0 28px',
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFC107" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
                <line x1="7" y1="7" x2="7.01" y2="7"/>
              </svg>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#92400e' }}>
                官方 9 折優惠券 × 1
              </span>
            </div>

            {/* CTA */}
            <button
              onClick={() => router.push('/profile/setup')}
              style={{
                width: '100%',
                background: '#FFC107',
                border: 'none',
                borderRadius: 16,
                padding: '17px',
                fontSize: 16,
                fontWeight: 800,
                color: '#1F1F1F',
                cursor: 'pointer',
                letterSpacing: '0.04em',
                fontFamily: '"Noto Sans TC", "PingFang TC", sans-serif',
              }}
            >
              前往綁定
            </button>

            {/* Skip */}
            <button
              onClick={() => router.replace('/products')}
              style={{
                width: '100%', background: 'none', border: 'none',
                marginTop: 12, padding: '10px',
                fontSize: 13, color: '#94a3b8', cursor: 'pointer',
              }}
            >
              稍後再說
            </button>
          </div>

          <style>{`
            @keyframes fadeIn  { from { opacity: 0; }                    to { opacity: 1; } }
            @keyframes slideUp { from { transform: translateY(60px); }   to { transform: translateY(0); } }
          `}</style>
        </div>
      )}
    </>
  )
}
