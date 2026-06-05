'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useParams } from 'next/navigation'
import { useLiff } from '@/components/liff/LiffProvider'
import { useTenant } from '@/components/liff/TenantContext'
import { BeeLogoSVG } from '@/components/liff/LiffIllustrations'

type Phase = 'splash' | 'modal' | 'redirecting'

export default function TenantLiffHome() {
  const { isReady, error } = useLiff()
  const router = useRouter()
  const params = useParams()
  const slug = params.slug as string
  const tenant = useTenant()

  const [phase, setPhase] = useState<Phase>('splash')
  const [splashOut, setSplashOut] = useState(false)
  const [profileComplete, setProfileComplete] = useState<boolean | null>(null)

  const primary = tenant?.primaryColor ?? '#FFC107'
  const brandName = tenant?.brandName ?? 'eSIM'

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

  useEffect(() => {
    if (profileComplete === null) return
    const t = setTimeout(() => {
      setSplashOut(true)
      setTimeout(() => {
        if (profileComplete) {
          setPhase('redirecting')
          router.replace(`/liff/${slug}/products`)
        } else {
          setPhase('modal')
        }
      }, 350)
    }, 500)
    return () => clearTimeout(t)
  }, [profileComplete, router, slug])

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 24 }}>
        <p style={{ color: '#ef4444', fontSize: 14, textAlign: 'center' }}>{error}</p>
      </div>
    )
  }

  return (
    <>
      {/* Splash */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: '#ffffff',
        display: 'flex', flexDirection: 'column',
        transition: 'opacity 0.4s ease',
        opacity: splashOut ? 0 : 1,
        pointerEvents: splashOut ? 'none' : 'auto',
        overflow: 'hidden',
      }}>
        {/* 上方品牌區 */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '48px 32px 24px', gap: 18,
        }}>
          {/* Logo 行內 + 品牌名 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, animation: 'fadeDown 0.6s ease both' }}>
            {tenant?.logoUrl
              ? <img src={tenant.logoUrl} alt={brandName} style={{ width: 52, height: 52, objectFit: 'contain' }} />
              : <BeeLogoSVG size={52} />
            }
            <span style={{ fontSize: 42, fontWeight: 900, color: '#1a1a1a', letterSpacing: '-0.02em', lineHeight: 1 }}>
              {brandName}
            </span>
          </div>
          {/* 副標 */}
          <div style={{ textAlign: 'center', animation: 'fadeDown 0.6s 0.1s ease both' }}>
            <p style={{ fontSize: 16, fontWeight: 600, color: '#333', margin: '0 0 6px', letterSpacing: '0.05em' }}>
              加入旅遊社群
            </p>
            <p style={{ fontSize: 13, color: '#888', margin: 0, letterSpacing: '0.08em' }}>
              領取專屬優惠・分享旅程回饋
            </p>
          </div>
        </div>

        {/* 下方插圖區 */}
        <div style={{ width: '100%', position: 'relative', flexShrink: 0 }}>
          <svg viewBox="0 0 390 300" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', display: 'block' }}>
            {/* 天空背景 */}
            <rect x="0" y="0" width="390" height="300" fill="#FFF9EC"/>

            {/* 地面 */}
            <rect x="0" y="250" width="390" height="50" fill="#F5E6C0" rx="0"/>
            <path d="M0 248 Q97.5 238 195 248 Q292.5 258 390 248 L390 300 L0 300 Z" fill="#F0DC9C"/>

            {/* 紙飛機 */}
            <g transform="translate(290,55) rotate(-15)" style={{ animation: 'planeFly 3s ease-in-out infinite' }}>
              <path d="M0 0 L30 10 L0 20 L8 10 Z" fill="none" stroke="#f59e0b" strokeWidth="1.8" strokeLinejoin="round"/>
              <path d="M8 10 L30 10" stroke="#f59e0b" strokeWidth="1.2"/>
            </g>

            {/* 星星/裝飾 */}
            {[[45,30],[320,45],[165,22],[85,60],[340,80]].map(([x,y],i) => (
              <g key={i} transform={`translate(${x},${y})`}>
                <circle cx="0" cy="0" r="2" fill="#FFC107" opacity="0.7"/>
              </g>
            ))}

            {/* 左：艾菲爾鐵塔 */}
            <g transform="translate(30, 80)">
              <path d="M40 165 L25 80 L40 20 L55 80 L40 165 Z" fill="none" stroke="#555" strokeWidth="1.6" strokeLinejoin="round"/>
              <path d="M28 95 Q40 88 52 95" fill="none" stroke="#555" strokeWidth="1.4"/>
              <path d="M24 120 Q40 112 56 120" fill="none" stroke="#555" strokeWidth="1.4"/>
              <path d="M30 145 Q40 138 50 145" fill="none" stroke="#555" strokeWidth="1.4"/>
              <rect x="36" y="14" width="8" height="10" fill="none" stroke="#555" strokeWidth="1.4"/>
            </g>

            {/* 中左：圓頂建築（蒙馬特/萬神殿） */}
            <g transform="translate(118, 108)">
              <rect x="0" y="80" width="80" height="60" fill="none" stroke="#555" strokeWidth="1.5"/>
              <path d="M0 80 L40 20 L80 80 Z" fill="none" stroke="#555" strokeWidth="1.5"/>
              <ellipse cx="40" cy="50" rx="16" ry="8" fill="none" stroke="#555" strokeWidth="1.4"/>
              <line x1="40" y1="20" x2="40" y2="5" stroke="#555" strokeWidth="1.5"/>
              <rect x="15" y="108" width="18" height="32" fill="none" stroke="#555" strokeWidth="1.3"/>
              <rect x="47" y="108" width="18" height="32" fill="none" stroke="#555" strokeWidth="1.3"/>
              <line x1="0" y1="108" x2="80" y2="108" stroke="#555" strokeWidth="1.2"/>
            </g>

            {/* 中：富士山 */}
            <g transform="translate(210, 88)">
              <path d="M0 160 L55 28 L110 160 Z" fill="none" stroke="#555" strokeWidth="1.6" strokeLinejoin="round"/>
              <path d="M35 62 Q55 46 75 62" fill="none" stroke="#fff" strokeWidth="3"/>
              <path d="M35 62 Q55 46 75 62" fill="none" stroke="#ddd" strokeWidth="1.5"/>
            </g>

            {/* 右：大笨鐘 */}
            <g transform="translate(310, 95)">
              <rect x="15" y="100" width="40" height="70" fill="none" stroke="#555" strokeWidth="1.5"/>
              <rect x="20" y="70" width="30" height="35" fill="none" stroke="#555" strokeWidth="1.5"/>
              <rect x="25" y="50" width="20" height="25" fill="none" stroke="#555" strokeWidth="1.5"/>
              <path d="M22 50 L35 35 L48 50 Z" fill="none" stroke="#555" strokeWidth="1.5"/>
              <circle cx="35" cy="82" r="9" fill="none" stroke="#555" strokeWidth="1.4"/>
              <line x1="35" y1="82" x2="35" y2="75" stroke="#555" strokeWidth="1.2"/>
              <line x1="35" y1="82" x2="41" y2="82" stroke="#555" strokeWidth="1.2"/>
              <rect x="22" y="118" width="10" height="20" fill="none" stroke="#555" strokeWidth="1.2"/>
              <rect x="38" y="118" width="10" height="20" fill="none" stroke="#555" strokeWidth="1.2"/>
            </g>

            {/* 前景：行李箱 */}
            <g transform="translate(158, 190)">
              <rect x="0" y="20" width="74" height="58" rx="8" fill="#f59e0b" stroke="#d97706" strokeWidth="2"/>
              <line x1="37" y1="20" x2="37" y2="78" stroke="#d97706" strokeWidth="1.8"/>
              <line x1="0" y1="49" x2="74" y2="49" stroke="#d97706" strokeWidth="1.8"/>
              <path d="M22 20 L22 8 Q37 0 52 8 L52 20" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round"/>
              <circle cx="10" cy="80" r="5" fill="#92400e"/>
              <circle cx="64" cy="80" r="5" fill="#92400e"/>
              <rect x="30" y="38" width="14" height="10" rx="3" fill="#fff" opacity="0.5"/>
            </g>
          </svg>

          <style>{`
            @keyframes fadeDown { from{opacity:0;transform:translateY(-12px)}to{opacity:1;transform:translateY(0)} }
            @keyframes planeFly { 0%,100%{transform:translate(0,0) rotate(-15deg)}50%{transform:translate(-6px,-6px) rotate(-18deg)} }
          `}</style>
        </div>
      </div>

      {/* Profile modal */}
      {phase === 'modal' && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 90,
          background: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          animation: 'fadeIn 0.25s ease',
        }}>
          <div style={{
            background: '#fff', borderRadius: '24px 24px 0 0',
            padding: '28px 24px 40px', width: '100%', maxWidth: 520,
            animation: 'slideUp 0.3s cubic-bezier(0.34,1.56,0.64,1)',
          }}>
            <div style={{ width: 40, height: 4, background: '#e2e8f0', borderRadius: 100, margin: '0 auto 24px' }} />
            <div style={{ width: 72, height: 72, background: '#FFF8E1', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <BeeLogoSVG size={48} />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1F1F1F', textAlign: 'center', margin: '0 0 10px' }}>
              完成個人資料綁定
            </h2>
            <p style={{ fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 1.7, margin: '0 0 8px' }}>
              填寫基本資料後，即可獲得
            </p>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              background: '#FFF8E1', border: '1.5px dashed #FFC107',
              borderRadius: 12, padding: '12px 20px', margin: '0 0 28px',
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFC107" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
                <line x1="7" y1="7" x2="7.01" y2="7"/>
              </svg>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#92400e' }}>官方 9 折優惠券 × 1</span>
            </div>
            <button
              onClick={() => router.push(`/liff/${slug}/profile/setup`)}
              style={{
                width: '100%', background: primary, border: 'none', borderRadius: 16,
                padding: '17px', fontSize: 16, fontWeight: 800, color: '#1F1F1F',
                cursor: 'pointer', letterSpacing: '0.04em',
              }}
            >
              前往綁定
            </button>
            <button
              onClick={() => router.replace(`/liff/${slug}/products`)}
              style={{ width: '100%', background: 'none', border: 'none', marginTop: 12, padding: '10px', fontSize: 13, color: '#94a3b8', cursor: 'pointer' }}
            >
              稍後再說
            </button>
          </div>
          <style>{`
            @keyframes fadeIn{from{opacity:0}to{opacity:1}}
            @keyframes slideUp{from{transform:translateY(60px)}to{transform:translateY(0)}}
          `}</style>
        </div>
      )}
    </>
  )
}
