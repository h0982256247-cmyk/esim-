'use client'

import { useEffect, useRef, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Script from 'next/script'
import { useLiff } from '@/components/liff/LiffProvider'

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

export default function PayPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><p className="text-gray-500">載入中…</p></div>}>
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

  const [sdkReady, setSdkReady] = useState(false)
  const [canPay, setCanPay] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const tapPayConfigRef = useRef<{ appId: number; appKey: string; env: string } | null>(null)

  // Fetch TapPay config from server (per-tenant, falls back to env vars)
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
      } catch {
        // Fallback handled server-side
      }
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
        number: { element: '#card-number', placeholder: '**** **** **** ****' },
        expirationDate: { element: '#card-expiry', placeholder: 'MM / YY' },
        ccv: { element: '#card-ccv', placeholder: 'CVV' },
      },
      styles: {
        input: { color: '#374151', 'font-size': '16px' },
        ':focus': { color: '#1d4ed8' },
        '.valid': { color: '#059669' },
        '.invalid': { color: '#dc2626' },
      },
    })
    setSdkReady(true)

    // 輪詢確認卡號輸入完整
    pollRef.current = setInterval(() => {
      const status = window.TPDirect.card.getTappayFieldsStatus()
      setCanPay(status.canGetPrime)
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

  return (
    <>
      <Script
        src="https://js.tappaysdk.com/tappay.js"
        onReady={initTapPay}
      />
      <div className="max-w-lg mx-auto px-4 pt-6 pb-32">
        <button onClick={() => router.back()} className="text-blue-600 text-sm mb-4">← 返回</button>
        <h1 className="text-xl font-bold mb-6">信用卡付款</h1>

        <div className="bg-white rounded-xl border p-5 shadow-sm space-y-4 mb-6">
          <div>
            <label className="text-sm text-gray-600 block mb-1">卡號</label>
            <div id="card-number" className="border rounded-lg px-3 py-3 bg-gray-50 min-h-[44px]" />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-sm text-gray-600 block mb-1">有效期限</label>
              <div id="card-expiry" className="border rounded-lg px-3 py-3 bg-gray-50 min-h-[44px]" />
            </div>
            <div className="flex-1">
              <label className="text-sm text-gray-600 block mb-1">安全碼</label>
              <div id="card-ccv" className="border rounded-lg px-3 py-3 bg-gray-50 min-h-[44px]" />
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="bg-red-50 text-red-600 text-sm rounded-xl px-4 py-3 mb-4">{errorMsg}</div>
        )}

        {!sdkReady && (
          <p className="text-gray-400 text-sm text-center mb-4">載入付款模組中…</p>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t px-4 py-3">
        <div className="max-w-lg mx-auto">
          <p className="text-center text-gray-500 text-sm mb-2">實付金額 <span className="font-bold text-blue-600 text-base">NT${amount}</span></p>
          <button
            onClick={handlePay}
            disabled={!canPay || submitting || !sdkReady}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50 active:bg-blue-700 transition"
          >
            {submitting ? '付款中…' : '確認付款'}
          </button>
        </div>
      </div>
    </>
  )
}
