'use client'

import type { HomeSplashProps } from './LandmarkSplash'
import { BeeLogoSVG } from '@/components/liff/LiffIllustrations'

export default function GradientSplash({ tenant, splashOut }: HomeSplashProps) {
  const brandName = tenant?.brandName ?? 'eSIM'
  const primary = tenant?.primaryColor ?? '#6366f1'

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: `linear-gradient(160deg, #0f0c29 0%, #302b63 50%, #24243e 100%)`,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      transition: 'opacity 0.4s ease',
      opacity: splashOut ? 0 : 1,
      pointerEvents: splashOut ? 'none' : 'auto',
      overflow: 'hidden',
    }}>
      {/* 極光光暈 */}
      <div style={{
        position: 'absolute', top: '-20%', left: '-20%',
        width: '80vw', height: '80vw',
        borderRadius: '50%',
        background: `radial-gradient(circle, ${primary}44 0%, transparent 70%)`,
        animation: 'auroraA 6s ease-in-out infinite alternate',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '-10%', right: '-15%',
        width: '60vw', height: '60vw',
        borderRadius: '50%',
        background: 'radial-gradient(circle, #06b6d444 0%, transparent 70%)',
        animation: 'auroraB 8s ease-in-out infinite alternate',
        pointerEvents: 'none',
      }} />

      {/* 星星 */}
      {Array.from({ length: 28 }).map((_, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: `${(i * 37 + 11) % 100}%`,
          top: `${(i * 53 + 7) % 100}%`,
          width: i % 4 === 0 ? 3 : 2,
          height: i % 4 === 0 ? 3 : 2,
          borderRadius: '50%',
          background: '#fff',
          opacity: 0.3 + (i % 5) * 0.12,
          animation: `twinkle ${2 + (i % 3)}s ease-in-out ${(i * 0.2) % 2}s infinite alternate`,
        }} />
      ))}

      {/* 主體內容 */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 28, padding: '0 32px', position: 'relative', zIndex: 1,
      }}>
        {/* Logo */}
        <div style={{
          width: 96, height: 96, borderRadius: '50%',
          background: 'rgba(255,255,255,0.08)',
          backdropFilter: 'blur(12px)',
          border: '1.5px solid rgba(255,255,255,0.18)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'fadeScaleIn 0.7s cubic-bezier(0.34,1.56,0.64,1) both',
          boxShadow: `0 0 40px ${primary}55`,
        }}>
          {tenant?.logoUrl
            ? <img src={tenant.logoUrl} alt={brandName} style={{ width: 60, height: 60, objectFit: 'contain', borderRadius: '50%' }} />
            : <BeeLogoSVG size={54} />
          }
        </div>

        {/* Brand name */}
        <div style={{ textAlign: 'center', animation: 'fadeUp 0.6s 0.2s ease both' }}>
          <h1 style={{
            fontSize: 44, fontWeight: 900, margin: 0,
            color: '#ffffff',
            letterSpacing: '-0.03em', lineHeight: 1,
          }}>
            {brandName}
          </h1>
          <p style={{
            fontSize: 14, color: 'rgba(255,255,255,0.55)',
            margin: '12px 0 0', letterSpacing: '0.18em',
            textTransform: 'uppercase', fontWeight: 500,
          }}>
            Travel · Connect · Explore
          </p>
        </div>

        {/* 載入指示 */}
        <div style={{
          display: 'flex', gap: 8,
          animation: 'fadeUp 0.6s 0.4s ease both',
        }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: 6, height: 6, borderRadius: '50%',
              background: primary,
              animation: `dotPulse 1.2s ease-in-out ${i * 0.2}s infinite`,
            }} />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes auroraA { from{transform:translate(0,0) scale(1)} to{transform:translate(10%,8%) scale(1.15)} }
        @keyframes auroraB { from{transform:translate(0,0) scale(1)} to{transform:translate(-8%,-6%) scale(1.1)} }
        @keyframes twinkle { from{opacity:0.15} to{opacity:0.85} }
        @keyframes fadeScaleIn { from{opacity:0;transform:scale(0.7)} to{opacity:1;transform:scale(1)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes dotPulse { 0%,80%,100%{transform:scale(0.6);opacity:0.4} 40%{transform:scale(1.2);opacity:1} }
      `}</style>
    </div>
  )
}
