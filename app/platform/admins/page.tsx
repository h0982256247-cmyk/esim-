'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type Admin = {
  id: string
  email: string
  name: string
  role: string
  isActive: boolean
  createdAt: string
  parent: { name: string } | null
}

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  PLATFORM_ADMIN: 'Platform Admin',
  SUB_ADMIN: 'Sub Admin',
}

export default function PlatformAdminsPage() {
  const router = useRouter()
  const [admins, setAdmins] = useState<Admin[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ email: '', password: '', name: '', role: 'SUB_ADMIN' })
  const [creating, setCreating] = useState(false)
  const [createMsg, setCreateMsg] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    fetch('/api/platform/admins')
      .then(r => r.status === 401 ? (router.replace('/platform/login'), null) : r.json())
      .then(d => { if (d) setAdmins(d.admins) })
      .finally(() => setLoading(false))
  }

  useEffect(load, [router])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    setCreateMsg(null)
    const r = await fetch('/api/platform/admins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    }).then(x => x.json())
    setCreating(false)
    if (r.admin) {
      setCreateMsg('✅ 帳號建立成功')
      setShowForm(false)
      setForm({ email: '', password: '', name: '', role: 'SUB_ADMIN' })
      load()
    } else {
      setCreateMsg(`❌ ${r.error}`)
    }
  }

  const handleToggle = async (id: string, isActive: boolean) => {
    await fetch(`/api/platform/admins/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !isActive }),
    })
    load()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">帳號管理</h1>
        <button
          onClick={() => setShowForm(p => !p)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm"
        >
          + 新增帳號
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-2xl border p-5 shadow-sm mb-6 space-y-3">
          <h2 className="font-semibold">建立新帳號</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: '姓名', key: 'name', type: 'text' },
              { label: '電子郵件', key: 'email', type: 'email' },
              { label: '密碼', key: 'password', type: 'password' },
            ].map(f => (
              <div key={f.key}>
                <label className="text-xs text-gray-500 block mb-1">{f.label}</label>
                <input
                  type={f.type}
                  value={form[f.key as keyof typeof form]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  required
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            ))}
            <div>
              <label className="text-xs text-gray-500 block mb-1">角色</label>
              <select
                value={form.role}
                onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="PLATFORM_ADMIN">Platform Admin</option>
                <option value="SUB_ADMIN">Sub Admin</option>
              </select>
            </div>
          </div>
          {createMsg && <p className="text-sm">{createMsg}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={creating} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50">
              {creating ? '建立中…' : '建立'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="bg-gray-100 text-gray-600 px-4 py-2 rounded-lg text-sm">
              取消
            </button>
          </div>
        </form>
      )}

      {loading ? <p className="text-gray-400 text-sm">載入中…</p> : (
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['姓名', '電子郵件', '角色', '上層帳號', '狀態', '建立時間', '操作'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {admins.map(a => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{a.name}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{a.email}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${a.role === 'SUPER_ADMIN' ? 'bg-purple-50 text-purple-600' : a.role === 'PLATFORM_ADMIN' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-600'}`}>
                      {ROLE_LABEL[a.role] ?? a.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">{a.parent?.name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${a.isActive ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                      {a.isActive ? '啟用' : '停用'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {new Date(a.createdAt).toLocaleDateString('zh-TW')}
                  </td>
                  <td className="px-4 py-3">
                    {a.role !== 'SUPER_ADMIN' && (
                      <button
                        onClick={() => handleToggle(a.id, a.isActive)}
                        className={`text-xs px-2.5 py-1 rounded-lg font-medium ${a.isActive ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
                      >
                        {a.isActive ? '停用' : '啟用'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
