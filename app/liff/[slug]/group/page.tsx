'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useTenantColors, useTenant } from '@/components/liff/TenantContext'
import { useLiff } from '@/components/liff/LiffProvider'
import PageSkeleton from '@/components/liff/PageSkeleton'

type GroupMemberInfo = { id: string; joinedAt: string; user: { id: string; displayName: string; avatarUrl: string | null } }
type GroupInfo  = { id: string; name: string; description: string | null; status: string; inviteCode: string; members: GroupMemberInfo[] }
type Membership = { group: { id: string; name: string; description: string | null }; joinedAt: string }

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

// 折扣（0.90）→ 折數標籤（9 折 / 92 折 / 95 折）
function zheLabel(d: number): string {
  const n = Math.round(d * 100)
  return n % 10 === 0 ? `${n / 10} 折` : `${n} 折`
}

export default function GroupPage() {
  const router = useRouter()
  const pathname = usePathname()
  const C = useTenantColors()
  const tenant = useTenant()
  const { liff } = useLiff()
  const slugMatch = pathname.match(/^(\/liff\/[^/]+)/)
  const base = slugMatch ? slugMatch[1] : ''
  const [ownedGroup, setOwnedGroup] = useState<GroupInfo | null>(null)
  const [membership, setMembership] = useState<Membership | null>(null)
  const [loading, setLoading] = useState(true)

  // 被邀請連結帶 ?invite=CODE 進來時預填邀請碼（lazy init 避免在 effect 內同步 setState）。
  const [inviteCode, setInviteCode] = useState(() =>
    typeof window !== 'undefined'
      ? (new URLSearchParams(window.location.search).get('invite')?.toUpperCase() ?? '')
      : ''
  )
  const [joinMsg, setJoinMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [joining, setJoining] = useState(false)
  const [joinedInfo, setJoinedInfo] = useState<{ groupName: string; couponDiscount: number | null } | null>(null)

  const [sharing, setSharing] = useState(false)

  // 一鍵邀請：用 LINE shareTargetPicker 分享含邀請碼的卡片；點開連結回到本頁並預填邀請碼。
  const handleInvite = async () => {
    if (!ownedGroup) return
    if (!liff || !liff.isApiAvailable('shareTargetPicker')) {
      window.alert(`請把邀請碼分享給朋友：${ownedGroup.inviteCode}`)
      return
    }
    setSharing(true)
    try {
      const fullUrl = `${window.location.origin}${base}/group?invite=${ownedGroup.inviteCode}`
      let inviteUrl = fullUrl
      try { inviteUrl = await liff.permanentLink.createUrlBy(fullUrl) } catch {}
      const brandName = tenant?.brandName ?? 'eSIM'
      const flex = {
        type: 'flex' as const,
        altText: `邀請你加入「${ownedGroup.name}」社群`,
        contents: {
          type: 'bubble' as const,
          body: {
            type: 'box' as const, layout: 'vertical' as const, spacing: 'md',
            contents: [
              { type: 'text' as const, text: `邀請你加入「${brandName}」社群`, weight: 'bold' as const, size: 'lg' as const, color: '#1a1a1a', wrap: true },
              { type: 'text' as const, text: ownedGroup.name, size: 'md' as const, weight: 'bold' as const, wrap: true, color: C.primary },
              { type: 'text' as const, text: '加入後即可獲得入群優惠券，一起買 eSIM 更划算！', size: 'sm' as const, color: '#475569', wrap: true },
              { type: 'separator' as const, margin: 'md' as const },
              { type: 'text' as const, text: `邀請碼：${ownedGroup.inviteCode}`, size: 'sm' as const, weight: 'bold' as const, color: '#1a1a1a', wrap: true },
            ],
          },
          footer: {
            type: 'box' as const, layout: 'vertical' as const, spacing: 'sm',
            contents: [
              { type: 'button' as const, style: 'primary' as const, color: C.primary,
                action: { type: 'uri' as const, label: '加入社群', uri: inviteUrl } },
            ],
          },
        },
      }
      await liff.shareTargetPicker([flex])
    } catch (err) {
      window.alert(err instanceof Error ? err.message : '分享失敗')
    }
    setSharing(false)
  }

  const reload = async () => {
    const d = await fetch('/api/groups').then(r => r.json())
    setOwnedGroup(d.ownedGroup ?? null)
    setMembership(d.membership ?? null)
  }

  useEffect(() => {
    reload().finally(() => setLoading(false))
  }, [])

  const handleJoin = async () => {
    if (!inviteCode.trim()) return
    setJoining(true); setJoinMsg(null)
    const r = await fetch('/api/groups/join', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inviteCode: inviteCode.trim() }),
    }).then(x => x.json())
    setJoining(false)
    if (r.ok) { setJoinedInfo({ groupName: r.groupName, couponDiscount: r.couponDiscount ?? null }); reload() }
    else setJoinMsg({ ok: false, text: r.error })
  }

  if (loading) return <PageSkeleton rows={4} />

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

  // 加入成功彈窗（領到入群券時慶祝）。各 view 都掛上，確保加入瞬間就跳出。
  const joinedPopup = joinedInfo && (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, zIndex: 60 }}
      onClick={() => setJoinedInfo(null)}
    >
      <div style={{ background: S.white, borderRadius: 20, padding: '28px 24px', maxWidth: 340, width: '100%', textAlign: 'center', boxShadow: '0 12px 40px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 44, marginBottom: 6 }}>🎉</div>
        <p style={{ fontSize: 18, fontWeight: 800, color: S.ink, margin: '0 0 6px' }}>已加入「{joinedInfo.groupName}」</p>
        {joinedInfo.couponDiscount != null ? (
          <>
            <p style={{ fontSize: 14, color: S.muted, margin: '0 0 2px' }}>恭喜獲得入群優惠券</p>
            <p style={{ fontSize: 30, fontWeight: 800, color: C.primary, margin: '0 0 18px' }}>{zheLabel(joinedInfo.couponDiscount)}</p>
          </>
        ) : (
          <p style={{ fontSize: 14, color: S.muted, margin: '0 0 18px' }}>歡迎加入社群！</p>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {joinedInfo.couponDiscount != null && (
            <button onClick={() => router.push(`${base}/coupons`)} style={btnEnabled(true)}>查看我的優惠券</button>
          )}
          <button onClick={() => setJoinedInfo(null)} style={{ border: 'none', background: 'transparent', color: S.faint, fontSize: 14, fontWeight: 600, padding: 8, cursor: 'pointer' }}>知道了</button>
        </div>
      </div>
    </div>
  )

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
            {/* 社群人數（收益/分潤改集中在「社群主後台」）*/}
            <div style={{ background: S.white, borderRadius: 14, border: `1px solid ${S.line}`, padding: '14px 16px', marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <p style={{ fontSize: 11, color: S.faint, fontWeight: 600, letterSpacing: '0.06em', margin: '0 0 4px' }}>社群人數</p>
              <p style={{ fontSize: 28, fontWeight: 800, color: S.ink, margin: 0, lineHeight: 1, letterSpacing: '-0.02em' }}>
                {ownedGroup.members.length.toLocaleString()}
              </p>
              <p style={{ fontSize: 11, color: S.faint, margin: '4px 0 0' }}>位會員 · 收益與分潤請見「社群主後台」</p>
            </div>

            {/* 邀請碼 + 一鍵邀請 */}
            <div style={{ background: S.white, borderRadius: 14, border: `1px solid ${S.line}`, padding: '16px 18px', marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <p style={{ fontSize: 11, color: S.faint, fontWeight: 600, letterSpacing: '0.06em', margin: '0 0 6px' }}>邀請碼</p>
              <p style={{ fontFamily: 'ui-monospace, monospace', fontSize: 26, fontWeight: 800, color: S.ink, letterSpacing: '0.2em', margin: '0 0 12px' }}>
                {ownedGroup.inviteCode}
              </p>
              <button
                onClick={handleInvite}
                disabled={sharing}
                style={{
                  width: '100%', border: 'none', borderRadius: 100, padding: '13px',
                  fontSize: 14, fontWeight: 800, cursor: sharing ? 'not-allowed' : 'pointer',
                  background: C.primary, color: C.onPrimary, opacity: sharing ? 0.6 : 1,
                }}
              >
                {sharing ? '開啟分享…' : '分享好友'}
              </button>
            </div>

            {/* 社群成員名單 */}
            <div style={{ background: S.white, borderRadius: 14, border: `1px solid ${S.line}`, padding: '16px 18px', marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <p style={{ fontSize: 11, color: S.faint, fontWeight: 600, letterSpacing: '0.06em', margin: '0 0 12px' }}>
                社群成員（{ownedGroup.members.length}）
              </p>
              {ownedGroup.members.length === 0 ? (
                <p style={{ fontSize: 13, color: S.faint, margin: 0 }}>還沒有成員，用上方「一鍵邀請」分享給朋友吧。</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {ownedGroup.members.map(m => (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {m.user.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.user.avatarUrl} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                      ) : (
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#e2e8f0', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: S.faint }}>
                          {m.user.displayName.slice(0, 1)}
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 14, fontWeight: 600, color: S.ink, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.user.displayName}</p>
                        <p style={{ fontSize: 11, color: S.faint, margin: '2px 0 0' }}>加入於 {new Date(m.joinedAt).toLocaleDateString('zh-TW')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

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
                <p style={{ fontSize: 12, color: '#b45309', margin: '2px 0 0' }}>收益報表、發券、提領與設定</p>
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

        <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button
            onClick={() => router.push(`${base}/coupons`)}
            style={{ width: '100%', background: S.white, border: `1px solid ${S.line}`, borderRadius: 14, padding: '15px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
          >
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: S.ink, margin: 0 }}>我的優惠券</p>
              <p style={{ fontSize: 12, color: S.faint, margin: '3px 0 0' }}>查看社群與官方發給你的折扣券</p>
            </div>
            <ChevronRight />
          </button>
          <button
            onClick={() => router.push(`${base}/products`)}
            style={{ width: '100%', background: S.white, border: `1px solid ${S.line}`, borderRadius: 14, padding: '15px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
          >
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: S.ink, margin: 0 }}>探索 eSIM 方案</p>
              <p style={{ fontSize: 12, color: S.faint, margin: '3px 0 0' }}>用優惠券購買更划算</p>
            </div>
            <ChevronRight />
          </button>
        </div>
        {joinedPopup}
      </div>
    )
  }

  // ── 未加入 ──
  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: '28px 16px 96px' }}>
      {joinedPopup}
      <h1 style={{ fontSize: 22, fontWeight: 800, color: S.ink, margin: '0 0 8px', letterSpacing: '-0.02em' }}>加入社群</h1>
      <p style={{ fontSize: 13, color: S.faint, margin: '0 0 20px', lineHeight: 1.6 }}>輸入朋友給你的邀請碼，加入後即可獲得入群優惠券。</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
    </div>
  )
}
