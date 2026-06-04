'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

type User = {
  id: string
  lineUid: string
  displayName: string
  avatarUrl: string | null
  phone: string | null
  email: string | null
  createdAt: string
  groupMembership: { group: { name: string } } | null
  ownedGroup: { name: string; status: string } | null
  _count: { orders: number; coupons: number }
}

export default function UsersPage() {
  return <Suspense fallback={<div className="text-gray-400">載入中…</div>}><UsersContent /></Suspense>
}

function UsersContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const page = parseInt(searchParams.get('page') ?? '1')
  const q = searchParams.get('q') ?? ''

  const [users, setUsers] = useState<User[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(q)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/platform/users?page=${page}&q=${encodeURIComponent(q)}`)
      .then(r => r.status === 401 ? (router.replace('/platform/login'), null) : r.json())
      .then(d => { if (d) { setUsers(d.users); setTotal(d.total) } })
      .finally(() => setLoading(false))
  }, [page, q, router])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    router.push(`/platform/users?q=${encodeURIComponent(search)}&page=1`)
  }

  const totalPages = Math.ceil(total / 20)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">會員管理</h1>
        <span className="text-sm text-gray-400">共 {total} 位</span>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2 mb-5">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="搜尋姓名 / LINE UID…"
          className="flex-1 border rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm">搜尋</button>
      </form>

      {loading ? (
        <p className="text-gray-400 text-sm">載入中…</p>
      ) : (
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['會員', '聯絡資訊', '社群', '訂單 / 優惠券', '加入時間'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {u.avatarUrl && <img src={u.avatarUrl} alt="" className="w-7 h-7 rounded-full" />}
                      <div>
                        <p className="font-medium">{u.displayName}</p>
                        <p className="text-xs text-gray-400">{u.lineUid.slice(0, 12)}…</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    <p>{u.phone ?? '—'}</p>
                    <p>{u.email ?? '—'}</p>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {u.ownedGroup ? (
                      <span className="text-blue-600">主：{u.ownedGroup.name}</span>
                    ) : u.groupMembership ? (
                      <span className="text-gray-600">員：{u.groupMembership.group.name}</span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {u._count.orders} 筆 / {u._count.coupons} 張
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {new Date(u.createdAt).toLocaleDateString('zh-TW')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && <p className="text-center text-gray-400 py-8 text-sm">無符合資料</p>}
        </div>
      )}

      {/* 分頁 */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-5">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <button
              key={p}
              onClick={() => router.push(`/platform/users?q=${encodeURIComponent(q)}&page=${p}`)}
              className={`w-8 h-8 rounded-lg text-sm ${p === page ? 'bg-blue-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
