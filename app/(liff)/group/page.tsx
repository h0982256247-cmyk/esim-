'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useTenantColors } from '@/components/liff/TenantContext'

type GroupInfo  = { id: string; name: string; description: string | null; status: string; inviteCode: string }
type Membership = { group: { id: string; name: string; description: string | null }; joinedAt: string }
type GroupStats = { memberCount: number; pendingAmount: number; settledAmount: number; recentCommissions: { id: string; amount: number; status: string; createdAt: string; orderTotal: number }[] }

const S = {
  white: '#ffffff', ink: '#1a1a1a', muted: '#4b5563', faint: '#94a3b8',
  line: 'rgba(0,0,0,0.07)',
} as const

const STATUS_META: Record<string, { text: string; bg: string; color: string }> = {
  PENDING:   { text: '審核中',  bg: '#fef9c3', color: '#a16207' },
  APPROVED:  { text: '已核准',  bg: '#dcfce7', color: '#15803d' },
  REJECTED:  { text: '未通過',  bg: '#fee2e2', color: '#b91c1c' },
  SUSPENDED: { text: '已停權',  bg: '#f1f5f9', color: '#475569' },
}

function ChevronRight() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={S.faint} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

function GroupOwnerBadge() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <circle cx="24" cy="24" r="22" stroke="#fde68a" strokeWidth="1.5" />
      <path d="M12 30 L18 18 L24 24 L30 14 L36 30 Z" stroke="#f59e0b" strokeWidth="1.5" fill="#fef3c7" strokeLinejoin="round" />
      <line x1="10" y1="33" x2="38" y2="33" stroke="#fde68a" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function MemberBadge() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <circle cx="24" cy="24" r="22" stroke="#bfdbfe" strokeWidth="1.5" />
      <path d="M32 34v-2a6 6 0 0 0-6-6H22a6 6 0 0 0-6 6v2" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="24" cy="18" r="5" stroke="#3b82f6" strokeWidth="1.5" />
    </svg>
  )
}

export default function GroupPage() {
  const router = useRouter()
  const pathname = usePathname()
  const C = useTenantColors()
  const slugMatch = pathname.match(/^(\/liff\/[^/]+)/)
  const base = slugMatch ? slugMatch[1] : ''
  const [ownedGroup, setOwnedGroup] = useState<GroupInfo | null>(null)
  const [membership, setMembership] = useState<Membership | null>(null)
  const [stats, setStats] = useState<GroupStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'join' | 'apply'>('join')

  const [inviteCode, setInviteCode] = useState('')
  const [joinMsg, setJoinMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [joining, setJoining] = useState(false)

  const [applyName, setApplyName] = useState('')
  const [applyDesc, setApplyDesc] = useState('')
  const [applying, setApplying] = useState(false)
  const [applyMsg, setApplyMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const reload = async () => {
    const d = await fetch('/api/groups').then(r => r.json())
    setOwnedGroup(d.ownedGroup ?? null)
    setMembership(d.membership ?? null)
    if (d.ownedGroup?.status === 'APPROVED') {
      const s = await fetch('/api/groups/stats').then(r => r.json())
      if (!s.error) setStats(s)
    }
  }

  useEffect(() => { reload().finally(() => setLoading(false)) }, [])

  const handleJoin = async () => {
    if (!inviteCode.trim()) return
    setJoining(true); setJoinMsg(null)
    const r = await fetch('/api/groups/join', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inviteCode: inviteCode.trim() }),
    }).then(x => x.json())
    setJoining(false)
    if (r.ok) { setJoinMsg({ ok: true, text: `已加入「${r.groupName}」，入群券已發放` }); reload() }
    else setJoinMsg({ ok: false, text: r.error })
  }

  const handleApply = async () => {
    if (!applyName.trim()) return
    setApplying(true); setApplyMsg(null)
    const r = await fetch('/api/groups', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: applyName, description: applyDesc }),
    }).then(x => x.json())
    setApplying(false)
    if (r.group) { setApplyMsg({ ok: true, text: '申請已送出，審核通過後即可使用' }); setOwnedGroup(r.group) }
    else setApplyMsg({ ok: false, text: r.error })
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ width: 28, height: 28, border: `2.5px solid ${C.light}`, borderTopColor: C.primary, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  const inputStyle: React.CSSProperties = {
    width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 14,
    padding: '13px 16px', fontSize: 14, outline: 'none',
    boxSizing: 'border-box', background: S.white, color: S.ink,
  }

  const btnEnabled = (enabled: boolean): React.CSSProperties => ({
    width: '100%', border: 'none', borderRadius: 100, padding: '15px',
    fontSize: 15, fontWeight: 800, cursor: enabled ? 'pointer' : 'not-allowed',
    background: enabled ? C.primary : '#e2e8f0',
    color: enabled ? C.onPrimary : S.faint,
    transition: 'all 0.15s',
    letterSpacing: '0.02em',
  })

  // ── 社群主視角 ──
  if (ownedGroup) {
    const s = STATUS_META[ownedGroup.status] ?? STATUS_META.PENDING
    return (
      <div style={{ maxWidth: 520, margin: '0 auto', padding: '28px 16px 96px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
          <GroupOwnerBadge />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h1 style={{ fontSize: 18, fontWeight: 800, color: S.ink, margin: 0 }}>{ownedGroup.name}</h1>
              <span style={{ fontSize: 11, fontWeight: 700, background: s.bg, color: s.color, padding: '2px 8px', borderRadius: 100 }}>{s.text}</span>
            </div>
            <p style={{ fontSize: 13, color: S.faint, margin: '3px 0 0' }}>社群主</p>
          </div>
        </div>

        {ownedGroup.description && (
          <p style={{ fontSize: 14, color: S.muted, marginBottom: 16, lineHeight: 1.6 }}>{ownedGroup.description}</p>
        )}

        {ownedGroup.status === 'APPROVED' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div style={{ background: S.white, borderRadius: 14, border: `1px solid ${S.line}`, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <p style={{ fontSize: 11, color: S.faint, fontWeight: 600, letterSpacing: '0.06em', margin: '0 0 4px' }}>社群人數</p>
                <p style={{ fontSize: 28, fontWeight: 800, color: S.ink, margin: 0, lineHeight: 1, letterSpacing: '-0.02em' }}>
                  {stats ? stats.memberCount.toLocaleString() : '—'}
                </p>
                <p style={{ fontSize: 11, color: S.faint, margin: '4px 0 0' }}>位會員</p>
              </div>
              <div style={{ background: S.white, borderRadius: 14, border: `1px solid ${S.line}`, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <p style={{ fontSize: 11, color: S.faint, fontWeight: 600, letterSpacing: '0.06em', margin: '0 0 4px' }}>待結算分潤</p>
                <p style={{ fontSize: 22, fontWeight: 800, color: C.primary, margin: 0, lineHeight: 1, letterSpacing: '-0.02em' }}>
                  {stats ? `NT$${Number(stats.pendingAmount).toLocaleString()}` : '—'}
                </p>
                <p style={{ fontSize: 11, color: S.faint, margin: '4px 0 0' }}>
                  已結算 {stats ? `NT$${Number(stats.settledAmount).toLocaleString()}` : '—'}
                </p>
              </div>
            </div>

            <div style={{ background: S.white, borderRadius: 14, border: `1px solid ${S.line}`, padding: '16px 18px', marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <p style={{ fontSize: 11, color: S.faint, fontWeight: 600, letterSpacing: '0.06em', margin: '0 0 6px' }}>邀請碼</p>
              <p style={{ fontFamily: 'ui-monospace, monospace', fontSize: 26, fontWeight: 800, color: S.ink, letterSpacing: '0.2em', margin: 0 }}>
                {ownedGroup.inviteCode}
              </p>
            </div>

            {stats && stats.recentCommissions.length > 0 && (
              <div style={{ background: S.white, borderRadius: 14, border: `1px solid ${S.line}`, padding: '16px 18px', marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <p style={{ fontSize: 11, color: S.faint, fontWeight: 600, letterSpacing: '0.06em', margin: '0 0 12px' }}>近期分潤明細</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {stats.recentCommissions.map(c => (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <p style={{ fontSize: 13, color: S.muted, margin: 0 }}>訂單金額 NT${Number(c.orderTotal).toLocaleString()}</p>
                        <p style={{ fontSize: 11, color: S.faint, margin: '2px 0 0' }}>{new Date(c.createdAt).toLocaleDateString('zh-TW')}</p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: 14, fontWeight: 700, color: c.status === 'SETTLED' ? '#15803d' : C.primary, margin: 0 }}>
                          +NT${Number(c.amount).toLocaleString()}
                        </p>
                        <p style={{ fontSize: 10, color: c.status === 'SETTLED' ? '#15803d' : S.faint, margin: '2px 0 0' }}>
                          {c.status === 'SETTLED' ? '已結算' : '待結算'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => router.push(`${base}/group-admin`)}
              style={{
                width: '100%', background: '#fffbeb', border: '1px solid #fde68a',
                borderRadius: 14, padding: '15px 18px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}
            >
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#78350f', margin: 0 }}>進入社群主後台</p>
                <p style={{ fontSize: 12, color: '#b45309', margin: '2px 0 0' }}>管理成員與分潤報表</p>
              </div>
              <ChevronRight />
            </button>
          </>
        )}

        {ownedGroup.status === 'PENDING' && (
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 14, padding: '14px 16px' }}>
            <p style={{ fontSize: 13, color: '#92400e', margin: 0, lineHeight: 1.6 }}>申請審核中，平台通過後即可使用社群功能。</p>
          </div>
        )}
      </div>
    )
  }

  // ── 社群會員視角 ──
  if (membership) {
    return (
      <div style={{ maxWidth: 520, margin: '0 auto', padding: '28px 16px 96px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
          <MemberBadge />
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 800, color: S.ink, margin: 0 }}>{membership.group.name}</h1>
            <p style={{ fontSize: 13, color: S.faint, margin: '3px 0 0' }}>
              加入於 {new Date(membership.joinedAt).toLocaleDateString('zh-TW')}
            </p>
          </div>
        </div>
        {membership.group.description && (
          <p style={{ fontSize: 14, color: S.muted, lineHeight: 1.6 }}>{membership.group.description}</p>
        )}
      </div>
    )
  }

  // ── 未加入 ──
  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: '28px 16px 96px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: S.ink, margin: '0 0 20px', letterSpacing: '-0.02em' }}>社群</h1>

      {/* Tabs */}
      <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 12, padding: 4, marginBottom: 20, gap: 4 }}>
        {(['join', 'apply'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: '9px 0', borderRadius: 9, fontSize: 13, fontWeight: 600,
            border: 'none', cursor: 'pointer', transition: 'all 0.15s',
            background: tab === t ? S.white : 'transparent',
            color: tab === t ? S.ink : S.faint,
            boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
          }}>
            {t === 'join' ? '加入社群' : '申請社群主'}
          </button>
        ))}
      </div>

      {tab === 'join' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontSize: 13, color: S.faint, margin: 0 }}>輸入邀請碼，加入後即獲得入群優惠券。</p>
          <input
            value={inviteCode}
            onChange={e => setInviteCode(e.target.value.toUpperCase())}
            placeholder="輸入邀請碼"
            maxLength={8}
            style={{ ...inputStyle, fontFamily: 'ui-monospace, monospace', fontSize: 24, fontWeight: 800, letterSpacing: '0.2em', textAlign: 'center' }}
          />
          {joinMsg && (
            <div style={{ background: joinMsg.ok ? '#dcfce7' : '#fee2e2', borderRadius: 12, padding: '12px 16px' }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: joinMsg.ok ? '#15803d' : '#b91c1c', margin: 0 }}>{joinMsg.text}</p>
            </div>
          )}
          <button onClick={handleJoin} disabled={!inviteCode.trim() || joining} style={btnEnabled(!!(inviteCode.trim() && !joining))}>
            {joining ? '加入中…' : '加入社群'}
          </button>
        </div>
      )}

      {tab === 'apply' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontSize: 13, color: S.faint, margin: 0 }}>申請成為社群主，管理成員並享有分潤收益。</p>
          <input value={applyName} onChange={e => setApplyName(e.target.value)} placeholder="社群名稱 *" style={inputStyle} />
          <textarea value={applyDesc} onChange={e => setApplyDesc(e.target.value)} placeholder="社群簡介（選填）" rows={3}
            style={{ ...inputStyle, resize: 'none' }} />
          {applyMsg && (
            <div style={{ background: applyMsg.ok ? '#dcfce7' : '#fee2e2', borderRadius: 12, padding: '12px 16px' }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: applyMsg.ok ? '#15803d' : '#b91c1c', margin: 0 }}>{applyMsg.text}</p>
            </div>
          )}
          <button onClick={handleApply} disabled={!applyName.trim() || applying} style={btnEnabled(!!(applyName.trim() && !applying))}>
            {applying ? '送出中…' : '送出申請'}
          </button>
        </div>
      )}
    </div>
  )
}
