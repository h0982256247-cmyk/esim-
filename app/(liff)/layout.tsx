import type { ReactNode } from 'react'
import { LiffProvider } from '@/components/liff/LiffProvider'
import LiffBottomNav from '@/components/liff/LiffBottomNav'

export default function LiffLayout({ children }: { children: ReactNode }) {
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID ?? ''

  return (
    <LiffProvider liffId={liffId}>
      <div className="min-h-screen bg-gray-50 pb-16">
        {children}
      </div>
      <LiffBottomNav />
    </LiffProvider>
  )
}
