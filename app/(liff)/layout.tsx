import type { ReactNode } from 'react'
import { LiffProvider } from '@/components/liff/LiffProvider'
import LiffBottomNav from '@/components/liff/LiffBottomNav'
import { CartProvider } from '@/components/liff/CartProvider'
import FloatingCart from '@/components/liff/FloatingCart'

export default function LiffLayout({ children }: { children: ReactNode }) {
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID ?? ''

  return (
    <LiffProvider liffId={liffId}>
      <CartProvider>
        <div className="min-h-screen pb-16 liff-root" style={{ background: '#f9f9f9' }}>
          {children}
        </div>
        <FloatingCart />
        <LiffBottomNav />
      </CartProvider>
    </LiffProvider>
  )
}
