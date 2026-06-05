'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { usePrimaryColor } from '@/components/liff/TenantContext'

type Product = {
  id: string
  countryNameZh: string
  displayDays: number
  sellPrice: number
  dataCapacity: string | null
}

type Coupon = {
  id: string
  type: string
  level: string
  discount: number
  expiresAt: string | null
}

const TYPE_LABEL: Record<string, string> = {
  OFFICIAL_WELCOME: '歡迎券',
  GROUP_JOIN: '入群券',
  GROUP_REPURCHASE: '回購券',
  GROUP_OWNER: '社群主專屬',
  GROUP_ACTIVITY: '活動券',
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><p className="text-gray-500">載入中…</p></div>}>
      <CheckoutContent />
    </Suspense>
  )
}

function CheckoutContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const productId = searchParams.get('productId')
  const primaryColor = usePrimaryColor()

  const [product, setProduct] = useState<Product | null>(null)
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [selectedCouponIds, setSelectedCouponIds] = useState<string[]>([])
  const [paymentMethod, setPaymentMethod] = useState<'CREDIT_CARD' | 'LINE_PAY'>('CREDIT_CARD')
  const [finalPrice, setFinalPrice] = useState<number | null>(null)
  const [comboError, setComboError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!productId) return
    Promise.all([
      fetch(`/api/products/${productId}`).then(r => r.json()),
      fetch('/api/coupons').then(r => r.json()),
    ]).then(([pd, cd]) => {
      setProduct(pd.product ?? null)
      const now = new Date()
      setCoupons((cd.coupons ?? []).filter((c: Coupon) => !('usedAt' in c && (c as { usedAt: string | null }).usedAt) && (!c.expiresAt || new Date(c.expiresAt) > now)))
    }).finally(() => setLoading(false))
  }, [productId])

  // 每次勾選優惠券時驗證組合
  useEffect(() => {
    if (!product || selectedCouponIds.length === 0) {
      setFinalPrice(product?.sellPrice ?? null)
      setComboError(null)
      return
    }
    fetch('/api/coupons/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ couponIds: selectedCouponIds, productPrice: product.sellPrice }),
    }).then(r => r.json()).then(d => {
      if (d.valid) {
        setFinalPrice(d.finalPrice)
        setComboError(null)
      } else {
        setFinalPrice(product.sellPrice)
        setComboError(d.reason)
      }
    })
  }, [selectedCouponIds, product])

  const toggleCoupon = (id: string) => {
    setSelectedCouponIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const handleSubmit = async () => {
    if (!product || !productId || comboError) return
    setSubmitting(true)

    // 建立訂單
    const orderRes = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, couponIds: selectedCouponIds, paymentMethod }),
    }).then(r => r.json())

    if (!orderRes.ok) {
      alert(orderRes.error ?? '建立訂單失敗')
      setSubmitting(false)
      return
    }

    const orderId = orderRes.orderId

    if (paymentMethod === 'CREDIT_CARD') {
      // 導向 TapPay 信用卡付款頁（帶入 orderId）
      router.push(`/checkout/pay?orderId=${orderId}&amount=${finalPrice ?? product.sellPrice}`)
    } else {
      // LINE Pay 流程（日後串接）
      router.push(`/checkout/pay?orderId=${orderId}&amount=${finalPrice ?? product.sellPrice}&method=LINE_PAY`)
    }
  }

  if (loading || !product) {
    return <div className="flex items-center justify-center min-h-screen"><p className="text-gray-500">載入中…</p></div>
  }

  const displayPrice = finalPrice ?? product.sellPrice
  const discount = product.sellPrice - displayPrice

  return (
    <div className="max-w-lg mx-auto pb-32">
      <div className="px-4 pt-6">
        <button onClick={() => router.back()} className="text-blue-600 text-sm mb-4">← 返回</button>
        <h1 className="text-xl font-bold mb-4">確認訂單</h1>

        {/* 商品摘要 */}
        <div className="bg-white rounded-xl border p-4 mb-4 shadow-sm">
          <p className="font-semibold">{product.countryNameZh} · {product.displayDays} 天</p>
          {product.dataCapacity && <p className="text-sm text-gray-500 mt-1">{product.dataCapacity}</p>}
          <p style={{ fontSize: 20, fontWeight: 800, color: primaryColor, marginTop: 8 }}>NT${product.sellPrice}</p>
        </div>

        {/* 優惠券選擇 */}
        {coupons.length > 0 && (
          <div className="mb-4">
            <h2 className="font-semibold mb-2">使用優惠券</h2>
            <div className="space-y-2">
              {coupons.map(c => (
                <label key={c.id} className={`flex items-center justify-between bg-white rounded-xl border p-3 cursor-pointer ${selectedCouponIds.includes(c.id) ? 'border-blue-500 bg-blue-50' : ''}`}>
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedCouponIds.includes(c.id)}
                      onChange={() => toggleCoupon(c.id)}
                      className="w-4 h-4"
                    />
                    <div>
                      <p className="text-sm font-medium">{TYPE_LABEL[c.type] ?? c.type}</p>
                      <p className="text-xs text-gray-400">{c.level} 級券</p>
                    </div>
                  </div>
                  <p style={{ fontWeight: 700, color: primaryColor }}>{Math.round((1 - c.discount) * 100)}% OFF</p>
                </label>
              ))}
            </div>
            {comboError && <p className="text-red-500 text-sm mt-2">{comboError}</p>}
          </div>
        )}

        {/* 付款方式 */}
        <div className="mb-4">
          <h2 className="font-semibold mb-2">付款方式</h2>
          <div className="space-y-2">
            {(['CREDIT_CARD', 'LINE_PAY'] as const).map(m => (
              <label key={m} className={`flex items-center gap-3 bg-white rounded-xl border p-3 cursor-pointer ${paymentMethod === m ? 'border-blue-500 bg-blue-50' : ''}`}>
                <input type="radio" checked={paymentMethod === m} onChange={() => setPaymentMethod(m)} className="w-4 h-4" />
                <span className="text-sm font-medium">{m === 'CREDIT_CARD' ? '💳 信用卡' : '💚 LINE Pay'}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* 結帳 bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t px-4 py-3">
        <div className="max-w-lg mx-auto">
          <div className="flex justify-between text-sm mb-1 text-gray-500">
            <span>商品金額</span><span>NT${product.sellPrice}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-sm mb-1 text-green-600">
              <span>優惠折扣</span><span>-NT${discount}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-base mb-3">
            <span>實付金額</span><span style={{ color: primaryColor }}>NT${displayPrice}</span>
          </div>
          <button
            onClick={handleSubmit}
            disabled={submitting || !!comboError}
            style={{
              width: '100%', background: submitting || comboError ? '#94a3b8' : primaryColor,
              color: '#fff', border: 'none', borderRadius: 12, padding: '14px',
              fontSize: 16, fontWeight: 700, cursor: submitting || comboError ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s',
            }}
          >
            {submitting ? '處理中…' : `確認付款 NT$${displayPrice}`}
          </button>
        </div>
      </div>
    </div>
  )
}
