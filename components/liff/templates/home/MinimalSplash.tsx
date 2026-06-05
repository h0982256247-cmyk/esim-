'use client'

import type { HomeSplashProps } from './LandmarkSplash'
import { BeeLogoSVG } from '@/components/liff/LiffIllustrations'

export default function MinimalSplash({ tenant, splashOut }: HomeSplashProps) {
  const brandName = tenant?.brandName ?? 'eSIM'
  const primary = tenant?.primaryColor ?? '#0284c7'

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: '#fafafa',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      transition: 'opacity 0.5s ease',
      opacity: splashOut ? 0 : 1,
      pointerEvents: splashOut ? 'none' : 'auto',
    }}>
      {/* 細線圓環動畫 */}
      <div style={{ position: 'relative', marginBottom: 36 }}>
        <svg width="160" height="160" viewBox="0 0 160 160" style={{ position: 'absolute', top: -32, left: -32, animation: 'spinSlow 8s linear infinite' }}>
          <circle cx="80" cy="80" r="72" fill="none" stroke={primary} strokeWidth="0.8" strokeDasharray="8 16" opacity="0.3"/>
        </svg>
        <svg width="120" height="120" viewBox="0 0 120 120" style={{ position: 'absolute', top: -12, left: -12, animation: 'spinSlow 5s linear infinite reverse' }}>
          <circle cx="60" cy="60" r="54" fill="none" stroke={primary} strokeWidth="0.6" strokeDasharray="4 20" opacity="0.2"/>
        </svg>

        {/* Logo */}
        <div style={{
          position: 'relative', zIndex: 1,
          width: 96, height: 96,
          borderRadius: '50%',
          background: '#ffffff',
          boxShadow: `0 4px 24px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'popIn 0.6s cubic-bezier(0.34,1.56,0.64,1) both',
        }}>
          {tenant?.logoUrl
            ? <img src={tenant.logoUrl} alt={brandName} style={{ width: 60, height: 60, objectFit: 'contain' }} />
            : <BeeLogoSVG size={54} />
          }
        </div>
      </div>

      {/* 品牌名 */}
      <div style={{ textAlign: 'center', animation: 'fadeUp 0.5s 0.15s ease both' }}>
        <h1 style={{
          fontSize: 34, fontWeight: 800, color: '#111',
          letterSpacing: '-0.03em', margin: 0,
        }}>
          {brandName}
        </h1>
        <div style={{
          width: 32, height: 2, borderRadius: 1,
          background: primary, margin: '14px auto 12px',
          animation: 'expandWidth 0.4s 0.3s ease both',
        }} />
        <p style={{ fontSize: 13, color: '#9ca3af', margin: 0, letterSpacing: '0.06em' }}>
          旅遊 eSIM 專門店
        </p>
      </div>

      <style>{`
        @keyframes spinSlow { to{transform:rotate(360deg)} }
        @keyframes popIn { from{opacity:0;transform:scale(0.75)} to{opacity:1;transform:scale(1)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes expandWidth { from{width:0;opacity:0} to{width:32px;opacity:1} }
      `}</style>
    </div>
  )
}
