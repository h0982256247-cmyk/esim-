'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type GroupInfo = {
  id: string
  name: string
  description: string | null
  status: string
  inviteCode: string
}

type MembershipInfo = {
  group: { id: string; name: string; description: string | null }
  joinedAt: string
}

const STATUS_LABEL: Record<string, { text: string; color: string }> = {
  PENDING: { text: '審核中', color: 'text-yellow-600' },
  APPROVED: { text: '已核准', color: 'text-green-600' },
  REJECTED: { text: '未通過', color: 'text-red-600' },
  SUSPENDED: { text: '已停權', color: 'text-gray-500' },
}

export default function GroupPage() {
  const router = useRouter()
  const [ownedGroup, setOwnedGroup] = useState<GroupInfo | null>(null)
  const [membership, setMembership] = useState<MembershipInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'join' | 'apply'>('join')

  // 加入社群
  const [inviteCode, setInviteCode] = useState('')
  const [joinMsg, setJoinMsg] = useState<string | null>(null)
  const [joining, setJoining] = useState(false)

  // 申請社群
  const [applyName, setApplyName] = useState('')
  const [applyDesc, setApplyDesc] = useState('')
  const [applying, setApplying] = useState(false)
  const [applyMsg, setApplyMsg] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/groups')
      .then(r => r.json())
      .then(d => {
        setOwnedGroup(d.ownedGroup ?? null)
        setMembership(d.membership ?? null)
      })
      .finally(() => setLoading(false))
  }, [])

  const handleJoin = async () => {
    if (!inviteCode.trim()) return
    setJoining(true)
    setJoinMsg(null)
    const r = await fetch('/api/groups/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inviteCode: inviteCode.trim() }),
    }).then(x => x.json())
    setJoining(false)
    if (r.ok) {
      setJoinMsg(`✅ 成功加入「${r.groupName}」，已發放入群券！`)
      // 重新載入
      fetch('/api/groups').then(x => x.json()).then(d => {
        setOwnedGroup(d.ownedGroup ?? null)
        setMembership(d.membership ?? null)
      })
    } else {
      setJoinMsg(`❌ ${r.error}`)
    }
  }

  const handleApply = async () => {
    if (!applyName.trim()) return
    setApplying(true)
    setApplyMsg(null)
    const r = await fetch('/api/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: applyName, description: applyDesc }),
    }).then(x => x.json())
    setApplying(false)
    if (r.group) {
      setApplyMsg('✅ 申請已送出，平台審核通過後即可使用社群功能')
      setOwnedGroup(r.group)
    } else {
      setApplyMsg(`❌ ${r.error}`)
    }
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen"><p className="text-gray-500">載入中…</p></div>

  // 已有自己的社群
  if (ownedGroup) {
    const s = STATUS_LABEL[ownedGroup.status] ?? { text: ownedGroup.status, color: 'text-gray-500' }
    return (
      <div className="max-w-lg mx-auto px-4 pt-6 pb-24">
        <h1 className="text-xl font-bold mb-4">我的社群</h1>
        <div className="bg-white rounded-xl border p-5 shadow-sm mb-4">
          <div className="flex justify-between items-start mb-2">
            <h2 className="text-lg font-semibold">{ownedGroup.name}</h2>
            <span className={`text-sm font-semibold ${s.color}`}>{s.text}</span>
          </div>
          {ownedGroup.description && <p className="text-sm text-gray-500">{ownedGroup.description}</p>}
          {ownedGroup.status === 'APPROVED' && (
            <div className="mt-3 pt-3 border-t">
              <p className="text-xs text-gray-400 mb-1">邀請碼</p>
              <p className="font-mono text-lg font-bold tracking-widest">{ownedGroup.inviteCode}</p>
            </div>
          )}
        </div>
        {ownedGroup.status === 'APPROVED' && (
          <button
            onClick={() => router.push('/group-admin')}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold"
          >
            進入社群主後台
          </button>
        )}
      </div>
    )
  }

  // 已加入別人的社群
  if (membership) {
    return (
      <div className="max-w-lg mx-auto px-4 pt-6 pb-24">
        <h1 className="text-xl font-bold mb-4">我的社群</h1>
        <div className="bg-white rounded-xl border p-5 shadow-sm">
          <p className="text-sm text-gray-400 mb-1">已加入</p>
          <h2 className="text-lg font-semibold">{membership.group.name}</h2>
          {membership.group.description && <p className="text-sm text-gray-500 mt-1">{membership.group.description}</p>}
          <p className="text-xs text-gray-400 mt-3">加入時間 {new Date(membership.joinedAt).toLocaleDateString('zh-TW')}</p>
        </div>
      </div>
    )
  }

  // 尚未加入任何社群
  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-24">
      <h1 className="text-xl font-bold mb-4">社群</h1>

      <div className="flex border-b mb-4">
        {(['join', 'apply'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 pb-2 text-sm font-medium border-b-2 transition ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400'}`}
          >
            {t === 'join' ? '加入社群' : '申請社群主'}
          </button>
        ))}
      </div>

      {tab === 'join' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">輸入社群邀請碼，加入後立即獲得入群優惠券。</p>
          <input
            value={inviteCode}
            onChange={e => setInviteCode(e.target.value.toUpperCase())}
            placeholder="輸入邀請碼（如 ABC12345）"
            className="w-full border rounded-xl px-4 py-3 font-mono tracking-widest text-lg uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
            maxLength={8}
          />
          {joinMsg && <p className="text-sm">{joinMsg}</p>}
          <button
            onClick={handleJoin}
            disabled={!inviteCode.trim() || joining}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50"
          >
            {joining ? '加入中…' : '加入社群'}
          </button>
        </div>
      )}

      {tab === 'apply' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">申請成為社群主，管理成員並享有分潤收益。</p>
          <input
            value={applyName}
            onChange={e => setApplyName(e.target.value)}
            placeholder="社群名稱 *"
            className="w-full border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <textarea
            value={applyDesc}
            onChange={e => setApplyDesc(e.target.value)}
            placeholder="社群簡介（選填）"
            rows={3}
            className="w-full border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
          {applyMsg && <p className="text-sm">{applyMsg}</p>}
          <button
            onClick={handleApply}
            disabled={!applyName.trim() || applying}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50"
          >
            {applying ? '送出中…' : '送出申請'}
          </button>
        </div>
      )}
    </div>
  )
}
