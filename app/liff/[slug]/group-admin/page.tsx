'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLiffBase } from '@/hooks/useLiffBase'

type GroupData = {
  id: string
  name: string
  status: string
  rebateRate: number
  inviteCode: string
  activityCouponQuota: number
  members: { id: string }[]
}

export default function GroupAdminDashboard() {
  const router = useRouter()
  const base = useLiffBase()
  const [group, setGroup] = useState<GroupData | null>(null)
  const [pendingBalance, setPendingBalance] = useState(0)
  const [loading, setLoading] = useState(true)
  const [noAccess, setNoAccess] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/groups').then(r => r.json()),
      fetch('/api/commissions').then(r => r.json()),
    ]).then(([gd, cd]) => {
      if (!gd.ownedGroup || gd.ownedGroup.status !== 'APPROVED') {
        setNoAccess(true)
      } else {
        setGroup(gd.ownedGroup)
        setPendingBalance(cd.pendingBalance ?? 0)
      }
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-gray-500">載入中…</p></div>

  if (noAccess) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-gray-500">尚未取得社群主權限</p>
        <button onClick={() => router.push(`${base}/group`)} className="text-blue-600 text-sm underline">前往申請</button>
      </div>
    )
  }

  if (!group) return null

  return (
    <div className="px-4 py-5 space-y-4">
      <div>
        <h1 className="text-xl font-bold">{group.name}</h1>
        <p className="text-xs text-gray-400">邀請碼：<span className="font-mono font-bold">{group.inviteCode}</span></p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl border p-4 shadow-sm">
          <p className="text-xs text-gray-400 mb-1">待結算收益</p>
          <p className="text-2xl font-bold text-blue-600">NT${pendingBalance.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border p-4 shadow-sm">
          <p className="text-xs text-gray-400 mb-1">社群成員</p>
          <p className="text-2xl font-bold text-gray-800">{group.members?.length ?? 0} 人</p>
        </div>
        <div className="bg-white rounded-xl border p-4 shadow-sm">
          <p className="text-xs text-gray-400 mb-1">讓利比例</p>
          <p className="text-2xl font-bold text-gray-800">{Math.round(Number(group.rebateRate) * 100)}%</p>
        </div>
        <div className="bg-white rounded-xl border p-4 shadow-sm">
          <p className="text-xs text-gray-400 mb-1">本月發券剩餘</p>
          <p className="text-2xl font-bold text-gray-800">{group.activityCouponQuota} 次</p>
        </div>
      </div>
    </div>
  )
}
