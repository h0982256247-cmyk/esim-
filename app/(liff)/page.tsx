'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useLiff } from '@/components/liff/LiffProvider'

export default function LiffHome() {
  const { isReady, error } = useLiff()
  const router = useRouter()

  useEffect(() => {
    if (!isReady) return

    // 取得 session 中的用戶資料，判斷是否需要填寫個資
    async function checkProfile() {
      const res = await fetch('/api/auth/me')
      if (!res.ok) return
      const { profileComplete } = await res.json()
      if (!profileComplete) {
        router.replace('/profile/setup')
      } else {
        router.replace('/products')
      }
    }

    checkProfile()
  }, [isReady, router])

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="text-center">
          <p className="text-red-500 text-sm">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center space-y-3">
        <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-gray-500 text-sm">載入中...</p>
      </div>
    </div>
  )
}
