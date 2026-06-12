import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import { LiffProvider } from '@/components/liff/LiffProvider'
import LiffBottomNav from '@/components/liff/LiffBottomNav'
import { CartProvider } from '@/components/liff/CartProvider'
import FloatingCart from '@/components/liff/FloatingCart'
import { getTenantByLiffId } from '@/lib/services/tenant'

// 單租戶部署用環境變數的 LIFF ID 反查後台品牌名稱當頁面標題，
// 取代 Next.js 預設的 "Create Next App"。
export async function generateMetadata(): Promise<Metadata> {
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID ?? ''
  const tenant = await getTenantByLiffId(liffId)
  return { title: tenant?.brandName ?? 'eSIM' }
}

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
