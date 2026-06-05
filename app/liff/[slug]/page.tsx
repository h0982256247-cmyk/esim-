'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useLiff } from '@/components/liff/LiffProvider'
import { useTenant } from '@/components/liff/TenantContext'
import { HOME_TEMPLATES } from '@/components/liff/templates/registry'

type Phase = 'splash' | 'redirecting'

export default function TenantLiffHome() {
  const { isReady, error } = useLiff()
  const router = useRouter()
  const params = useParams()
  const slug = params.slug as string
  const tenant = useTenant()

  const [phase, setPhase] = useState<Phase>('splash')
  const [splashOut, setSplashOut] = useState(false)
  const [profileComplete, setProfileComplete] = useState<boolean | null>(null)

  useEffect(() => {
    if (!isReady) return
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(data => {
      setProfileComplete(data ? !!data.profileComplete : false)
    })
  }, [isReady])

  useEffect(() => {
    if (profileComplete === null) return
    const t = setTimeout(() => {
      setSplashOut(true)
      setTimeout(() => {
        setPhase('redirecting')
        router.replace(profileComplete
          ? `/liff/${slug}/products`
          : `/liff/${slug}/products?setup=1`
        )
      }, 350)
    }, 500)
    return () => clearTimeout(t)
  }, [profileComplete, router, slug])

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 24 }}>
        <p style={{ color: '#ef4444', fontSize: 14, textAlign: 'center' }}>{error}</p>
      </div>
    )
  }

  const templateKey = tenant?.homeTemplate ?? 'landmark'
  const SplashTemplate = HOME_TEMPLATES[templateKey]

  return <SplashTemplate tenant={tenant} splashOut={splashOut} />
}
