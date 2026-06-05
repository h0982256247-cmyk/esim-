'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLiff } from '@/components/liff/LiffProvider'
import { useLiffBase } from '@/hooks/useLiffBase'
import { usePrimaryColor } from '@/components/liff/TenantContext'

export default function ProfileSetup() {
  const { liff } = useLiff()
  const router = useRouter()
  const base = useLiffBase()
  const primaryColor = usePrimaryColor()

  const [form, setForm] = useState({ name: '', phone: '', email: '', birthday: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  function validate() {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = '請輸入姓名'
    if (!/^09\d{8}$/.test(form.phone)) e.phone = '請輸入正確手機號碼（09xxxxxxxx）'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = '請輸入正確 Email'
    if (!form.birthday) e.birthday = '請選擇生日'
    return e
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      if (!res.ok) {
        const { error } = await res.json()
        setErrors({ submit: error })
        return
      }

      router.replace(`${base}/products`)
    } catch {
      setErrors({ submit: '送出失敗，請稍後再試' })
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    border: '1.5px solid #e2e8f0',
    borderRadius: 14,
    padding: '13px 16px',
    fontSize: 16,
    outline: 'none',
    boxSizing: 'border-box',
    background: '#fff',
    color: '#0f172a',
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', padding: '24px 20px 40px', background: '#fff', maxWidth: 520, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 32, marginTop: 8 }}>
        <div style={{
          width: 52, height: 52, background: primaryColor,
          borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 16,
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.82a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
          </svg>
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', margin: '0 0 6px' }}>完成註冊</h1>
        <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>
          填寫以下資料，完成後即獲得{' '}
          <span style={{ color: primaryColor, fontWeight: 600 }}>官方 9 折優惠券</span>
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18, flex: 1 }}>
        {/* 姓名 */}
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>姓名</label>
          <input
            type="text"
            placeholder="請輸入真實姓名"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            style={inputStyle}
          />
          {errors.name && <p style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>{errors.name}</p>}
        </div>

        {/* 手機 */}
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>手機號碼</label>
          <input
            type="tel"
            placeholder="09xxxxxxxx"
            value={form.phone}
            onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
            style={inputStyle}
          />
          {errors.phone && <p style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>{errors.phone}</p>}
        </div>

        {/* Email */}
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>電子信箱</label>
          <input
            type="email"
            placeholder="email@example.com"
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            style={inputStyle}
          />
          {errors.email && <p style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>{errors.email}</p>}
        </div>

        {/* 生日 */}
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>生日</label>
          <input
            type="date"
            value={form.birthday}
            onChange={e => setForm(f => ({ ...f, birthday: e.target.value }))}
            style={inputStyle}
          />
          {errors.birthday && <p style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>{errors.birthday}</p>}
        </div>

        {errors.submit && (
          <p style={{ fontSize: 13, color: '#ef4444', textAlign: 'center' }}>{errors.submit}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            background: loading ? '#94a3b8' : primaryColor,
            color: '#fff',
            border: 'none',
            borderRadius: 16,
            padding: '16px',
            fontSize: 16,
            fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
            marginTop: 8,
            letterSpacing: '0.02em',
            transition: 'background 0.15s',
          }}
        >
          {loading ? '儲存中...' : '完成註冊，領取 9 折券'}
        </button>
      </form>
    </div>
  )
}
