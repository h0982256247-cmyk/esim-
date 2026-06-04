'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

type Group = {
  id: string
  name: string
  status: string
  rebateRate: number
  inviteCode: string
  createdAt: string
  owner: { displayName: string; lineUid: string }
  _count: { members: number }
}

type CurrentUser = {
  role: string
  maxRebateRate: number
}

const STATUS_OPTS = ['', 'PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED']
const STATUS_LABEL: Record<string, { text: string; color: string }> = {
  PENDING: { text: '審核中', color: 'text-yellow-600 bg-yellow-50' },
  APPROVED: { text: '已核准', color: 'text-green-600 bg-green-50' },
  REJECTED: { text: '已拒絕', color: 'text-red-600 bg-red-50' },
  SUSPENDED: { text: '已停權', color: 'text-gray-500 bg-gray-100' },
}

export default function GroupsPage() {
  return <Suspense fallback={<div className="text-gray-400">載入中…</div>}><GroupsContent /></Suspense>
}

function GroupsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const statusFilter = searchParams.get('status') ?? ''

  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)

  // Inline rebate edit
  const [editingRebate, setEditingRebate] = useState<string | null>(null)
  const [rebateInput, setRebateInput] = useState('')
  const [savingRebate, setSavingRebate] = useState(false)
  const [rebateError, setRebateError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    fetch(`/api/admin/groups${statusFilter ? `?status=${statusFilter}` : ''}`)
      .then(r => r.status === 401 ? (router.replace('/platform/login'), null) : r.json())
      .then(d => { if (d) setGroups(d.groups) })
      .finally(() => setLoading(false))
  }

  useEffect(load, [statusFilter, router])

  useEffect(() => {
    fetch('/api/platform/auth/me')
      .then(r => r.json())
      .then(d => {
        if (d.admin) {
          setCurrentUser({
            role: d.admin.role,
            maxRebateRate: d.admin.maxRebateRate != null ? Number(d.admin.maxRebateRate) : 0.30,
          })
        }
      })
  }, [])

  const handleApprove = async (id: string) => {
    setActionLoading(id + '_approve')
    await fetch(`/api/admin/groups/${id}/approve`, { method: 'POST' })
    setActionLoading(null)
    load()
  }

  const handleReject = async (id: string) => {
    setActionLoading(id + '_reject')
    await fetch(`/api/admin/groups/${id}/reject`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
    setActionLoading(null)
    load()
  }

  const startEditRebate = (g: Group) => {
    setEditingRebate(g.id)
    setRebateInput(String(Math.round(Number(g.rebateRate) * 100)))
    setRebateError(null)
  }

  const handleSaveRebate = async (groupId: string) => {
    setSavingRebate(true)
    setRebateError(null)
    const pct = parseFloat(rebateInput)
    const ceiling = currentUser?.maxRebateRate ?? 0.30
    if (isNaN(pct) || pct < 0 || pct > ceiling * 100) {
      setRebateError(`請輸入 0 ~ ${Math.round(ceiling * 100)} 之間的數值`)
      setSavingRebate(false)
      return
    }
    const r = await fetch(`/api/admin/groups/${groupId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rebateRate: pct / 100 }),
    }).then(x => x.json())
    setSavingRebate(false)
    if (r.ok) {
      setEditingRebate(null)
      load()
    } else {
      setRebateError(r.error ?? '設定失敗')
    }
  }

  const canEditRebate = currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'PLATFORM_ADMIN'

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">社群管理</h1>
        <div className="flex gap-2">
          {STATUS_OPTS.map(s => (
            <button
              key={s}
              onClick={() => router.push(s ? `/platform/groups?status=${s}` : '/platform/groups')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${statusFilter === s ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              {s ? (STATUS_LABEL[s]?.text ?? s) : '全部'}
            </button>
          ))}
        </div>
      </div>

      {loading ? <p className="text-gray-400 text-sm">載入中…</p> : (
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['社群', '社群主', '成員', '讓利比例', '狀態', '操作'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {groups.map(g => {
                const s = STATUS_LABEL[g.status] ?? { text: g.status, color: 'text-gray-500 bg-gray-100' }
                const ceiling = currentUser?.maxRebateRate ?? 0.30
                return (
                  <tr key={g.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium">{g.name}</p>
                      <p className="text-xs text-gray-400 font-mono">{g.inviteCode}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{g.owner.displayName}</td>
                    <td className="px-4 py-3 text-xs">{g._count.members} 人</td>

                    {/* 讓利比例欄位 */}
                    <td className="px-4 py-3 text-xs">
                      {editingRebate === g.id ? (
                        <div className="flex flex-col gap-1 min-w-[160px]">
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min={0}
                              max={Math.round(ceiling * 100)}
                              step={1}
                              value={rebateInput}
                              onChange={e => setRebateInput(e.target.value)}
                              className="w-14 border rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <span className="text-gray-400">%</span>
                            <button
                              onClick={() => handleSaveRebate(g.id)}
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
                          <p className="text-gray-400" style={{ fontSize: '10px' }}>上限：{Math.round(ceiling * 100)}%</p>
                          {rebateError && <p className="text-red-500" style={{ fontSize: '10px' }}>{rebateError}</p>}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium">{Math.round(Number(g.rebateRate) * 100)}%</span>
                          {canEditRebate && g.status === 'APPROVED' && (
                            <button
                              onClick={() => startEditRebate(g)}
                              className="text-gray-300 hover:text-blue-500 transition text-xs leading-none"
                              title="設定讓利比例"
                            >
                              ✏️
                            </button>
                          )}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.color}`}>{s.text}</span>
                    </td>
                    <td className="px-4 py-3">
                      {g.status === 'PENDING' && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApprove(g.id)}
                            disabled={!!actionLoading}
                            className="text-xs bg-green-600 text-white px-2.5 py-1 rounded-lg disabled:opacity-50"
                          >
                            {actionLoading === g.id + '_approve' ? '…' : '核准'}
                          </button>
                          <button
                            onClick={() => handleReject(g.id)}
                            disabled={!!actionLoading}
                            className="text-xs bg-red-500 text-white px-2.5 py-1 rounded-lg disabled:opacity-50"
                          >
                            {actionLoading === g.id + '_reject' ? '…' : '拒絕'}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {groups.length === 0 && <p className="text-center text-gray-400 py-8 text-sm">無資料</p>}
        </div>
      )}
    </div>
  )
}
