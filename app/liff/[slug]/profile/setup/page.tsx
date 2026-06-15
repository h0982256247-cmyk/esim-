'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useLiffBase } from '@/hooks/useLiffBase'
import { useTenantColors } from '@/components/liff/TenantContext'
import { invalidateCache } from '@/hooks/useCachedData'

const S = {
  ink: '#1a1a1a', muted: '#4b5563', faint: '#94a3b8', line: '#e2e8f0',
} as const

export default function ProfileSetup() {
  const router = useRouter()
  const base = useLiffBase()
  const C = useTenantColors()

  const [form, setForm] = useState({ name: '', phone: '', email: '', birthday: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  // 已填過（phone/email 任一已有）→ 編輯模式：不再發歡迎券，文案改「儲存」。
  // 與後端 issueCoupon 的 isFirstUpdate(!phone && !email) 判斷一致。
  const [alreadyFilled, setAlreadyFilled] = useState(false)

  // 進頁載入現有資料預填：再打開時看得到已存的內容（而不是空白＝看起來像沒存）。
  // 讀 /api/users/me（phone/email 已在後端解密）；首次填寫無資料則維持空白。
  useEffect(() => {
    fetch('/api/users/me')
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        const u = d?.user
        if (!u) return
        setForm({
          name: u.realName ?? '',
          phone: u.phone ?? '',
          email: u.email ?? '',
          birthday: u.birthday ? String(u.birthday).slice(0, 10) : '',  // ISO → YYYY-MM-DD
        })
        setAlreadyFilled(!!(u.phone || u.email))
      })
      .catch(() => { /* 預填失敗不阻擋填寫 */ })
  }, [])

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
      // 存檔成功 → 清掉 profile 快取，讓「個人資料」頁與首頁提醒立即反映已完成
      invalidateCache('profile')
      // 若帶了 ?redirect=（例如從結帳被導來），完成後回到原頁；限同 base 防開放轉址
      const redirect = typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('redirect')
        : null
      router.replace(redirect && redirect.startsWith(`${base}/`) ? redirect : `${base}/products`)
    } catch {
      setErrors({ submit: '送出失敗，請稍後再試' })
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', border: `1.5px solid ${S.line}`, borderRadius: 14,
    padding: '13px 16px', fontSize: 16, outline: 'none',
    boxSizing: 'border-box', background: '#fff', color: S.ink,
  }

  const fields = [
    { key: 'name',     label: '姓名',   type: 'text',  placeholder: '請輸入真實姓名' },
    { key: 'phone',    label: '手機號碼', type: 'tel',  placeholder: '09xxxxxxxx' },
    { key: 'email',    label: '電子信箱', type: 'email', placeholder: 'email@example.com' },
    { key: 'birthday', label: '生日',    type: 'date',  placeholder: '' },
  ] as const

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', padding: '24px 20px 40px', background: '#fff', maxWidth: 520, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 32, marginTop: 8 }}>
        <div style={{
          width: 52, height: 52, background: C.primary,
          borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 16,
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.onPrimary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.82a16 16 0 0 0 6.29 6.29l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
          </svg>
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: S.ink, margin: '0 0 6px', letterSpacing: '-0.02em' }}>
          {alreadyFilled ? '個人資料' : '完成註冊'}
        </h1>
        {alreadyFilled ? (
          <p style={{ fontSize: 14, color: S.muted, margin: 0 }}>更新你的基本資料</p>
        ) : (
          <p style={{ fontSize: 14, color: S.muted, margin: 0 }}>
            填寫以下資料，完成後即獲得{' '}
            <span style={{ color: C.primary, fontWeight: 700 }}>官方 9 折優惠券</span>
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18, flex: 1 }}>
        {fields.map(({ key, label, type, placeholder }) => (
          <div key={key}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: S.muted, marginBottom: 6 }}>{label}</label>
            <input
              type={type}
              placeholder={placeholder}
              value={form[key]}
              onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
              style={{
                ...inputStyle,
                borderColor: errors[key] ? '#ef4444' : S.line,
              }}
            />
            {errors[key] && <p style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>{errors[key]}</p>}
          </div>
        ))}

        {errors.submit && (
          <p style={{ fontSize: 13, color: '#ef4444', textAlign: 'center' }}>{errors.submit}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            background: loading ? '#94a3b8' : C.primary,
            color: C.onPrimary,
            border: 'none', borderRadius: 100,
            padding: '16px', fontSize: 16, fontWeight: 800,
            cursor: loading ? 'not-allowed' : 'pointer',
            marginTop: 8, letterSpacing: '0.02em',
            transition: 'background 0.15s',
            boxShadow: loading ? 'none' : `0 4px 14px ${C.primary}40`,
          }}
        >
          {loading ? '儲存中...' : alreadyFilled ? '儲存' : '完成註冊，領取 9 折券'}
        </button>
      </form>
    </div>
  )
}
