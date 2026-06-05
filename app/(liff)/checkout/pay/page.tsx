'use client'

import { useEffect, useRef, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Script from 'next/script'
import { useLiff } from '@/components/liff/LiffProvider'
import { useTenantColors } from '@/components/liff/TenantContext'

declare global {
  interface Window {
    TPDirect: {
      setupSDK: (appId: number, appKey: string, env: string) => void
      card: {
        setup: (config: object) => void
        getPrime: (callback: (result: { status: number; card: { prime: string }; msg: string }) => void) => void
        getTappayFieldsStatus: () => { canGetPrime: boolean }
      }
    }
  }
}

const S = {
  white: '#ffffff', ink: '#1a1a1a', muted: '#4b5563', faint: '#94a3b8',
  line: 'rgba(0,0,0,0.07)',
} as const

export default function PayPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <p style={{ color: S.faint }}>載入中…</p>
      </div>
    }>
      <PayContent />
    </Suspense>
  )
}

function PayContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const orderId = searchParams.get('orderId')!
  const amount = searchParams.get('amount')!
  const { liff } = useLiff()
  const C = useTenantColors()

  const [sdkReady, setSdkReady] = useState(false)
  const [canPay, setCanPay] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const tapPayConfigRef = useRef<{ appId: number; appKey: string; env: string } | null>(null)

  useEffect(() => {
    async function fetchConfig() {
      try {
        const profile = liff ? await liff.getProfile().catch(() => null) : null
        const lineUid = profile?.userId ?? ''
        const url = lineUid
          ? `/api/liff/payment-config?lineUid=${encodeURIComponent(lineUid)}`
          : '/api/liff/payment-config'
        const res = await fetch(url).then(r => r.json())
        tapPayConfigRef.current = res
      } catch { /* fallback handled server-side */ }
    }
    fetchConfig()
  }, [liff])

  const initTapPay = () => {
    const cfg = tapPayConfigRef.current
    const appId = cfg?.appId ?? parseInt(process.env.NEXT_PUBLIC_TAPPAY_APP_ID ?? '0')
    const appKey = cfg?.appKey ?? process.env.NEXT_PUBLIC_TAPPAY_APP_KEY ?? ''
    const env = cfg?.env ?? (process.env.NEXT_PUBLIC_TAPPAY_ENV === 'production' ? 'production' : 'sandbox')

    window.TPDirect.setupSDK(appId, appKey, env)
    window.TPDirect.card.setup({
      fields: {
        number:         { element: '#card-number', placeholder: '**** **** **** ****' },
        expirationDate: { element: '#card-expiry', placeholder: 'MM / YY' },
        ccv:            { element: '#card-ccv',    placeholder: 'CVV' },
      },
      styles: {
        input:    { color: '#374151', 'font-size': '16px' },
        ':focus': { color: S.ink },
        '.valid':   { color: '#059669' },
        '.invalid': { color: '#dc2626' },
      },
    })
    setSdkReady(true)

    pollRef.current = setInterval(() => {
      setCanPay(window.TPDirect.card.getTappayFieldsStatus().canGetPrime)
    }, 500)
  }

  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current)
  }, [])

  const handlePay = () => {
    if (!canPay || submitting) return
    setSubmitting(true)
    setErrorMsg(null)

    window.TPDirect.card.getPrime(async result => {
      if (result.status !== 0) {
        setErrorMsg(result.msg ?? '取得卡片資訊失敗')
        setSubmitting(false)
        return
      }

      const res = await fetch('/api/payment/tappay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, prime: result.card.prime }),
      }).then(r => r.json())

      if (res.ok) {
        router.replace(`/orders/${orderId}`)
      } else {
        setErrorMsg(res.error ?? '付款失敗，請重試')
        setSubmitting(false)
      }
    })
  }

  const fieldStyle: React.CSSProperties = {
    border: `1.5px solid rgba(0,0,0,0.1)`,
    borderRadius: 12,
    padding: '14px 16px',
    background: '#fafafa',
    minHeight: 48,
  }

  const disabled = !canPay || submitting || !sdkReady

  return (
    <>
      <Script src="https://js.tappaysdk.com/tappay.js" onReady={initTapPay} />

      <div style={{ maxWidth: 520, margin: '0 auto', padding: '20px 16px 120px' }}>
        {/* Header */}
        <button
          onClick={() => router.back()}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 4, color: C.primary, fontSize: 14 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          返回
        </button>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: S.ink, margin: '0 0 20px', letterSpacing: '-0.02em' }}>信用卡付款</h1>

        {/* Card form */}
        <div style={{ background: S.white, borderRadius: 16, border: `1px solid ${S.line}`, padding: '20px', marginBottom: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: S.muted, marginBottom: 6 }}>卡號</label>
            <div id="card-number" style={fieldStyle} />
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: S.muted, marginBottom: 6 }}>有效期限</label>
              <div id="card-expiry" style={fieldStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: S.muted, marginBottom: 6 }}>安全碼</label>
              <div id="card-ccv" style={fieldStyle} />
            </div>
          </div>
        </div>

        {errorMsg && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '12px 16px', marginBottom: 12 }}>
            <p style={{ fontSize: 13, color: '#dc2626', margin: 0 }}>{errorMsg}</p>
          </div>
        )}

        {!sdkReady && (
          <p style={{ textAlign: 'center', color: S.faint, fontSize: 13, marginBottom: 8 }}>載入付款模組中…</p>
        )}
      </div>

      {/* Sticky bottom bar */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: S.white,
        borderTop: `1px solid ${S.line}`,
        boxShadow: '0 -4px 20px rgba(0,0,0,0.08)',
        padding: '14px 20px',
        paddingBottom: 'calc(14px + env(safe-area-inset-bottom))',
      }}>
        <div style={{ maxWidth: 520, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div>
            <p style={{ fontSize: 12, color: S.faint, margin: 0 }}>實付金額</p>
            <p style={{ fontSize: 24, fontWeight: 800, color: C.primary, margin: 0, letterSpacing: '-0.03em', lineHeight: 1.1 }}>
              NT${amount}
            </p>
          </div>
          <button
            onClick={handlePay}
            disabled={disabled}
            style={{
              flex: 1,
              background: disabled ? '#94a3b8' : C.primary,
              color: C.onPrimary,
              border: 'none', borderRadius: 100,
              padding: '15px 24px',
              fontSize: 16, fontWeight: 800,
              cursor: disabled ? 'not-allowed' : 'pointer',
              letterSpacing: '0.02em',
              transition: 'background 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            {submitting ? '付款中…' : '確認付款 →'}
          </button>
        </div>
      </div>
    </>
  )
}
