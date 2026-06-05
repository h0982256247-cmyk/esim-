import type { ReactNode } from 'react'
import { LiffProvider } from '@/components/liff/LiffProvider'
import LiffBottomNav from '@/components/liff/LiffBottomNav'

export default function LiffLayout({ children }: { children: ReactNode }) {
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID ?? ''

  return (
    <LiffProvider liffId={liffId}>
      <div className="min-h-screen pb-16" style={{ background: '#f8f9fb' }}>
        {children}
      </div>
      <LiffBottomNav />
    </LiffProvider>
  )
}
