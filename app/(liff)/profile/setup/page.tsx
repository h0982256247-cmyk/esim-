'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLiff } from '@/components/liff/LiffProvider'

export default function ProfileSetup() {
  const { liff } = useLiff()
  const router = useRouter()

  const [form, setForm] = useState({ phone: '', email: '', birthday: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  function validate() {
    const e: Record<string, string> = {}
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

      router.replace('/products')
    } catch {
      setErrors({ submit: '送出失敗，請稍後再試' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col p-6 bg-white">
      {/* Header */}
      <div className="mb-8 mt-4">
        <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mb-4">
          <span className="text-white text-xl">📱</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">完成註冊</h1>
        <p className="text-gray-500 mt-1 text-sm">填寫以下資料，完成後即獲得 <span className="text-green-600 font-medium">官方 9 折優惠券</span></p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 flex-1">
        {/* 手機 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">手機號碼</label>
          <input
            type="tel"
            placeholder="09xxxxxxxx"
            value={form.phone}
            onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">電子信箱</label>
          <input
            type="email"
            placeholder="email@example.com"
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
        </div>

        {/* 生日 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">生日</label>
          <input
            type="date"
            value={form.birthday}
            onChange={e => setForm(f => ({ ...f, birthday: e.target.value }))}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          {errors.birthday && <p className="text-red-500 text-xs mt-1">{errors.birthday}</p>}
        </div>

        {errors.submit && (
          <p className="text-red-500 text-sm text-center">{errors.submit}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-green-500 text-white rounded-xl py-4 text-base font-semibold disabled:opacity-50 mt-4"
        >
          {loading ? '儲存中...' : '完成註冊，領取 9 折券'}
        </button>
      </form>
    </div>
  )
}
