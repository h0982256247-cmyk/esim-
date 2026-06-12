'use client'

import { useEffect, useState } from 'react'

type Member = {
  id: string
  user: { id: string; displayName: string }
}

export default function GroupAdminCouponsPage() {
  const [members, setMembers] = useState<Member[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [discount, setDiscount] = useState('0.95')
  const [sending, setSending] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [quota, setQuota] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/groups')
      .then(r => r.json())
      .then(d => {
        setMembers(d.ownedGroup?.members ?? [])
        setQuota(d.ownedGroup?.activityCouponQuota ?? 0)
      })
      .finally(() => setLoading(false))
  }, [])

  const toggle = (id: string) => {
    setSelectedIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])
  }

  const handleSend = async () => {
    if (selectedIds.length === 0 || !discount) return
    setSending(true)
    setMsg(null)
    const r = await fetch('/api/groups/coupons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberUserIds: selectedIds, discount: parseFloat(discount) }),
    }).then(x => x.json())
    setSending(false)
    if (r.ok) {
      setMsg(`✅ 已發送給 ${selectedIds.length} 位成員，配額剩餘 ${(quota ?? 1) - 1} 次`)
      setSelectedIds([])
      setQuota(q => (q ?? 1) - 1)
    } else {
      setMsg(`❌ ${r.error}`)
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-gray-500">載入中…</p></div>

  return (
    <div className="px-4 py-5">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">發送活動券</h1>
        <span className="text-sm text-gray-500">本月剩餘 <span className="font-bold text-blue-600">{quota}</span> 次</span>
      </div>

      <div className="mb-4">
        <label className="text-sm text-gray-600 block mb-1">折扣比例</label>
        <select
          value={discount}
          onChange={e => setDiscount(e.target.value)}
          className="w-full border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="0.95">95 折（5% OFF）</option>
          <option value="0.92">92 折（8% OFF）</option>
          <option value="0.90">9 折（10% OFF）</option>
          <option value="0.88">88 折（12% OFF）</option>
          <option value="0.85">85 折（15% OFF）</option>
          <option value="0.80">8 折（20% OFF）</option>
        </select>
      </div>

      <p className="text-sm text-gray-500 mb-2">選擇發送對象（共 {members.length} 位成員）</p>
      <div className="space-y-2 mb-4">
        {members.length === 0 && <p className="text-gray-400 text-sm py-4 text-center">目前沒有社群成員</p>}
        {members.map(m => (
          <label key={m.id} className={`flex items-center gap-3 bg-white rounded-xl border p-3 cursor-pointer ${selectedIds.includes(m.user.id) ? 'border-blue-500 bg-blue-50' : ''}`}>
            <input
              type="checkbox"
              checked={selectedIds.includes(m.user.id)}
              onChange={() => toggle(m.user.id)}
              className="w-4 h-4"
            />
            <span className="text-sm font-medium">{m.user.displayName}</span>
          </label>
        ))}
      </div>

      {msg && <p className="text-sm mb-3">{msg}</p>}

      <button
        onClick={handleSend}
        disabled={selectedIds.length === 0 || sending || quota === 0}
        className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50"
      >
        {sending ? '發送中…' : `發送給 ${selectedIds.length} 位成員`}
      </button>
      {quota === 0 && <p className="text-center text-sm text-red-500 mt-2">本月發送次數已用完</p>}
    </div>
  )
}
