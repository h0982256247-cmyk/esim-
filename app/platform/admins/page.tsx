'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Admin = {
  id: string
  email: string
  name: string
  role: string
  isActive: boolean
  createdAt: string
  maxRebateRate: number
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
  const [currentRole, setCurrentRole] = useState<string | null>(null)

  // Create form
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ email: '', password: '', name: '', role: 'SUB_ADMIN' })
  const [creating, setCreating] = useState(false)
  const [createMsg, setCreateMsg] = useState<string | null>(null)

  // Inline rebate edit
  const [editingRebate, setEditingRebate] = useState<string | null>(null)
  const [rebateInput, setRebateInput] = useState('')
  const [savingRebate, setSavingRebate] = useState(false)
  const [rebateError, setRebateError] = useState<string | null>(null)

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<Admin | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    fetch('/api/platform/admins')
      .then(r => r.status === 401 ? (router.replace('/platform/login'), null) : r.json())
      .then(d => { if (d) setAdmins(d.admins) })
      .finally(() => setLoading(false))
  }

  useEffect(load, [router])

  useEffect(() => {
    fetch('/api/platform/auth/me')
      .then(r => r.json())
      .then(d => { if (d.admin) setCurrentRole(d.admin.role) })
  }, [])

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

  const startEditRebate = (a: Admin) => {
    setEditingRebate(a.id)
    setRebateInput(String(Math.round(Number(a.maxRebateRate) * 100)))
    setRebateError(null)
  }

  const handleSaveRebate = async (id: string) => {
    setSavingRebate(true)
    setRebateError(null)
    const pct = parseFloat(rebateInput)
    if (isNaN(pct) || pct < 0 || pct > 30) {
      setRebateError('請輸入 0 ~ 30 之間的數值')
      setSavingRebate(false)
      return
    }
    const r = await fetch(`/api/platform/admins/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ maxRebateRate: pct / 100 }),
    }).then(x => x.json())
    setSavingRebate(false)
    if (r.ok) {
      setEditingRebate(null)
      load()
    } else {
      setRebateError(r.error ?? '設定失敗')
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError(null)
    const r = await fetch(`/api/platform/admins/${deleteTarget.id}`, { method: 'DELETE' }).then(x => x.json())
    setDeleting(false)
    if (r.ok) {
      setDeleteTarget(null)
      load()
    } else {
      setDeleteError(r.error ?? '移除失敗')
    }
  }

  return (
    <div>
      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h2 className="text-lg font-bold mb-1">確認移除帳號</h2>
            <p className="text-sm text-gray-500 mb-4">
              即將移除 <span className="font-semibold text-gray-800">{deleteTarget.name}</span>（{deleteTarget.email}），此操作無法復原。
            </p>
            {deleteError && <p className="text-sm text-red-500 mb-3">{deleteError}</p>}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setDeleteTarget(null); setDeleteError(null) }}
                disabled={deleting}
                className="px-4 py-2 rounded-lg text-sm bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-lg text-sm bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 font-medium"
              >
                {deleting ? '移除中…' : '確認移除'}
              </button>
            </div>
          </div>
        </div>
      )}

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
                {['姓名', '電子郵件', '角色', '讓利上限', '上層帳號', '狀態', '建立時間', '操作'].map(h => (
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

                  {/* 讓利上限欄位（僅 PLATFORM_ADMIN 可設定）*/}
                  <td className="px-4 py-3 text-xs">
                    {a.role === 'PLATFORM_ADMIN' ? (
                      editingRebate === a.id ? (
                        <div className="flex flex-col gap-1 min-w-[140px]">
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min={0}
                              max={30}
                              step={1}
                              value={rebateInput}
                              onChange={e => setRebateInput(e.target.value)}
                              className="w-14 border rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <span className="text-gray-400">%</span>
                            <button
                              onClick={() => handleSaveRebate(a.id)}
                              disabled={savingRebate}
                              className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded disabled:opacity-50"
                            >
                              {savingRebate ? '…' : '存'}
                            </button>
                            <button
                              onClick={() => { setEditingRebate(null); setRebateError(null) }}
                              className="text-xs text-gray-400 hover:text-gray-600 px-1"
                            >
                              ✕
                            </button>
                          </div>
                          {rebateError && <p className="text-red-500 text-xs">{rebateError}</p>}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-blue-600">
                            {Math.round(Number(a.maxRebateRate) * 100)}%
                          </span>
                          {currentRole === 'SUPER_ADMIN' && (
                            <button
                              onClick={() => startEditRebate(a)}
                              className="text-gray-300 hover:text-blue-500 transition text-xs leading-none"
                              title="編輯讓利上限"
                            >
                              ✏️
                            </button>
                          )}
                        </div>
                      )
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
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
                    <div className="flex items-center gap-2">
                      {a.role === 'PLATFORM_ADMIN' && currentRole === 'SUPER_ADMIN' && (
                        <Link
                          href={`/platform/admins/${a.id}`}
                          className="text-xs px-2.5 py-1 rounded-lg font-medium bg-blue-50 text-blue-600 hover:bg-blue-100"
                        >
                          查看
                        </Link>
                      )}
                      {a.role !== 'SUPER_ADMIN' && (
                        <>
                          <button
                            onClick={() => handleToggle(a.id, a.isActive)}
                            className={`text-xs px-2.5 py-1 rounded-lg font-medium ${a.isActive ? 'bg-orange-50 text-orange-600 hover:bg-orange-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
                          >
                            {a.isActive ? '停用' : '啟用'}
                          </button>
                          {currentRole === 'SUPER_ADMIN' && (
                            <button
                              onClick={() => { setDeleteTarget(a); setDeleteError(null) }}
                              className="text-xs px-2.5 py-1 rounded-lg font-medium bg-red-50 text-red-600 hover:bg-red-100"
                            >
                              移除
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {admins.length === 0 && <p className="text-center text-gray-400 py-8 text-sm">無資料</p>}
        </div>
      )}
    </div>
  )
}
