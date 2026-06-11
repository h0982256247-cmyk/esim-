'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTenantColors } from '@/components/liff/TenantContext'
import { findBestCouponCombo as _findBestCouponCombo } from '@/lib/utils/coupon-combo'
import { CountryFlag } from '@/components/common/CountryFlag'
import { useCart } from '@/components/liff/CartProvider'

type Product = {
  id: string
  countryCode: string
  countryNameZh: string
  countryFlag: string | null
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
  GROUP_JOIN:       '入群券',
  GROUP_REPURCHASE: '回購券',
  GROUP_OWNER:      '社群主專屬',
  GROUP_ACTIVITY:   '活動券',
}

// 使用共用版本
const findBestCouponCombo = _findBestCouponCombo

function TicketIcon({ color }: { color: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  )
}

function CreditCardIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  )
}

function LinePayIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ width: 28, height: 28, border: '2.5px solid #fde68a', borderTopColor: '#FFC107', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    }>
      <CheckoutContent />
    </Suspense>
  )
}

function CheckoutContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const productId = searchParams.get('productId')
  const C = useTenantColors()
  const cart = useCart()

  const [product, setProduct] = useState<Product | null>(null)
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [selectedCouponIds, setSelectedCouponIds] = useState<string[]>([])
  const [autoSelectedIds, setAutoSelectedIds] = useState<string[]>([])  // 記錄自動帶入的組合
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
      const prod: Product | null = pd.product ?? null
      setProduct(prod)
      const now = new Date()
      const validCoupons: Coupon[] = (cd.coupons ?? []).filter((c: Coupon) =>
        !('usedAt' in c && (c as { usedAt: string | null }).usedAt) &&
        (!c.expiresAt || new Date(c.expiresAt) > now)
      )
      setCoupons(validCoupons)
      // 自動帶入最優惠組合
      if (prod && validCoupons.length > 0) {
        const best = findBestCouponCombo(validCoupons, prod.sellPrice)
        setSelectedCouponIds(best)
        setAutoSelectedIds(best)
      }
    }).finally(() => setLoading(false))
  }, [productId])

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
    // Order placed → remove from cart so the user doesn't see it lingering after returning
    cart.remove(productId)
    if (paymentMethod === 'CREDIT_CARD') {
      router.push(`/checkout/pay?orderId=${orderId}&amount=${finalPrice ?? product.sellPrice}`)
    } else {
      router.push(`/checkout/pay?orderId=${orderId}&amount=${finalPrice ?? product.sellPrice}&method=LINE_PAY`)
    }
  }

  if (loading || !product) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ width: 28, height: 28, border: `2.5px solid ${C.light}`, borderTopColor: C.primary, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  const displayPrice = finalPrice ?? product.sellPrice
  const discount = product.sellPrice - displayPrice

  const paymentOptions = [
    { key: 'CREDIT_CARD' as const, label: '信用卡', sublabel: 'Visa / Mastercard / JCB', Icon: CreditCardIcon },
    { key: 'LINE_PAY' as const,   label: 'LINE Pay', sublabel: '使用 LINE Pay 付款', Icon: LinePayIcon },
  ]

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', paddingBottom: 120 }}>
      {/* Header */}
      <div style={{ padding: '20px 20px 8px' }}>
        <button
          onClick={() => router.back()}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6, color: C.primary, fontSize: 14 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          返回
        </button>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1a1a1a', margin: 0, letterSpacing: '-0.02em' }}>確認訂單</h1>
      </div>

      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Product card */}
        <div style={{
          background: '#fff',
          borderRadius: 16,
          border: '1px solid rgba(0,0,0,0.07)',
          padding: '18px 20px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
          display: 'flex', alignItems: 'center', gap: 16,
        }}>
          {/* Flag / icon */}
          <div style={{
            width: 56, height: 56, borderRadius: 14, flexShrink: 0,
            background: C.light,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <CountryFlag code={product.countryCode} fallbackEmoji={product.countryFlag} size={40} />
          </div>

          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a', margin: '0 0 4px' }}>{product.countryNameZh}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{
                fontSize: 12, fontWeight: 600, color: '#4b5563',
                background: '#f3f4f6', borderRadius: 6, padding: '2px 8px',
              }}>
                {product.displayDays} 天
              </span>
              {product.dataCapacity && (
                <span style={{
                  fontSize: 12, fontWeight: 600, color: '#4b5563',
                  background: '#f3f4f6', borderRadius: 6, padding: '2px 8px',
                }}>
                  {product.dataCapacity}
                </span>
              )}
            </div>
            <p style={{ fontSize: 20, fontWeight: 800, color: C.primary, margin: 0, letterSpacing: '-0.02em' }}>
              NT${product.sellPrice.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Coupon section */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 8px 4px' }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a', margin: 0 }}>使用優惠券</p>
            {autoSelectedIds.length > 0 && (
              <span style={{
                fontSize: 11, fontWeight: 600,
                background: '#d1fae5', color: '#065f46',
                padding: '2px 8px', borderRadius: 100,
                display: 'flex', alignItems: 'center', gap: 3,
              }}>
                ✦ 已自動帶入最優惠組合
              </span>
            )}
          </div>
          {coupons.length === 0 ? (
            <div style={{
              background: '#fff', borderRadius: 12,
              border: '1px solid rgba(0,0,0,0.07)',
              padding: '14px 16px',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <TicketIcon color="#94a3b8" />
              <span style={{ flex: 1, fontSize: 14, color: '#94a3b8' }}>選取或輸入優惠碼</span>
              <span style={{ fontSize: 13, color: '#c4c9d4' }}>尚無可用 ›</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {coupons.map(c => {
                const selected = selectedCouponIds.includes(c.id)
                return (
                  <label
                    key={c.id}
                    style={{
                      display: 'flex', alignItems: 'center',
                      background: selected ? C.light : '#fff',
                      borderRadius: 12,
                      border: `1.5px solid ${selected ? C.primary : 'rgba(0,0,0,0.07)'}`,
                      padding: '13px 16px', cursor: 'pointer',
                      transition: 'border-color 0.15s, background 0.15s',
                    }}
                  >
                    <div style={{ marginRight: 12, flexShrink: 0 }}>
                      <TicketIcon color={selected ? C.primary : '#94a3b8'} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', margin: 0 }}>{TYPE_LABEL[c.type] ?? c.type}</p>
                      <p style={{ fontSize: 12, color: '#94a3b8', margin: '2px 0 0' }}>{c.level} 級券</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 15, fontWeight: 800, color: C.primary }}>
                        {Math.round((1 - c.discount) * 100)}% OFF
                      </span>
                      {/* Custom checkbox */}
                      <div
                        style={{
                          width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                          border: `2px solid ${selected ? C.primary : '#d1d5db'}`,
                          background: selected ? C.primary : '#fff',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.15s',
                        }}
                        onClick={() => toggleCoupon(c.id)}
                      >
                        {selected && (
                          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke={C.onPrimary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="2 6 5 9 10 3" />
                          </svg>
                        )}
                      </div>
                    </div>
                  </label>
                )
              })}
              {comboError && (
                <p style={{ fontSize: 12, color: '#ef4444', margin: '0 0 0 4px' }}>{comboError}</p>
              )}
            </div>
          )}
        </div>

        {/* Payment method */}
        <div>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a', margin: '0 0 8px 4px' }}>付款方式</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {paymentOptions.map(({ key, label, sublabel, Icon }) => {
              const active = paymentMethod === key
              return (
                <label
                  key={key}
                  onClick={() => setPaymentMethod(key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    background: active ? C.light : '#fff',
                    borderRadius: 12,
                    border: `1.5px solid ${active ? C.primary : 'rgba(0,0,0,0.07)'}`,
                    padding: '14px 16px', cursor: 'pointer',
                    transition: 'border-color 0.15s, background 0.15s',
                  }}
                >
                  {/* Custom radio */}
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                    border: `2px solid ${active ? C.primary : '#d1d5db'}`,
                    background: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'border-color 0.15s',
                  }}>
                    {active && (
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.primary }} />
                    )}
                  </div>
                  <div style={{ color: active ? C.primary : '#4b5563', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                    <Icon />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', margin: 0 }}>{label}</p>
                    <p style={{ fontSize: 12, color: '#94a3b8', margin: '2px 0 0' }}>{sublabel}</p>
                  </div>
                </label>
              )
            })}
          </div>
        </div>

        {/* Price summary */}
        <div style={{
          background: '#fff', borderRadius: 12,
          border: '1px solid rgba(0,0,0,0.07)',
          padding: '16px 20px',
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#64748b' }}>
            <span>商品原價</span>
            <span>NT${product.sellPrice.toLocaleString()}</span>
          </div>
          {discount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#16a34a' }}>
              <span>優惠折扣</span>
              <span>-NT${discount.toLocaleString()}</span>
            </div>
          )}
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            fontSize: 15, fontWeight: 700,
            borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: 10, marginTop: 2,
          }}>
            <span style={{ color: '#1a1a1a' }}>實付金額</span>
            <span style={{ color: C.primary, fontSize: 18, letterSpacing: '-0.02em' }}>NT${displayPrice.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Sticky bottom bar */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: '#fff',
        borderTop: '1px solid rgba(0,0,0,0.08)',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.08)',
        padding: '14px 20px',
        paddingBottom: 'calc(14px + env(safe-area-inset-bottom))',
      }}>
        <div style={{ maxWidth: 520, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div>
            {discount > 0 && (
              <p style={{ fontSize: 12, color: '#94a3b8', margin: 0, textDecoration: 'line-through' }}>NT${product.sellPrice.toLocaleString()}</p>
            )}
            <p style={{ fontSize: 24, fontWeight: 800, color: C.primary, margin: 0, letterSpacing: '-0.03em', lineHeight: 1.1 }}>
              NT${displayPrice.toLocaleString()}
            </p>
            {discount > 0 && (
              <p style={{ fontSize: 11, color: '#16a34a', margin: '2px 0 0', fontWeight: 600 }}>省 NT${discount.toLocaleString()}</p>
            )}
          </div>
          <button
            onClick={handleSubmit}
            disabled={submitting || !!comboError}
            style={{
              flex: 1,
              background: submitting || comboError ? '#94a3b8' : C.primary,
              color: C.onPrimary,
              border: 'none', borderRadius: 100,
              padding: '15px 24px',
              fontSize: 16, fontWeight: 800,
              cursor: submitting || comboError ? 'not-allowed' : 'pointer',
              letterSpacing: '0.02em',
              transition: 'background 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            {submitting ? '處理中…' : '確認付款 →'}
          </button>
        </div>
      </div>
    </div>
  )
}
