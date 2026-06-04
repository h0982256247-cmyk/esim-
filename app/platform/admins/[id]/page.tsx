'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'

// ─── Types ────────────────────────────────────────────────────────

type AdminDetail = {
  id: string
  email: string
  name: string
  role: string
  isActive: boolean
  createdAt: string
  maxRebateRate: number
  tenantSlug: string | null
  brandName: string | null
  logoUrl: string | null
  primaryColor: string | null
  _count: { ownedGroups: number }
}

type Stats = {
  totalUsers: number
  totalOrders: number
  totalRevenue: number
  pendingGroups: number
  approvedGroups: number
  pendingCommissions: number
  esimPendingOrders: number
}

type EsimConfig = {
  provider: string
  apiUrl: string
  merchantId: string
  deptId: string
  token: string
  isActive: boolean
  updatedAt: string
} | null

type PaymentConfig = {
  id: string
  gateway: string
  partnerKey: string
  merchantId: string
  env: string
  isActive: boolean
  updatedAt: string
}

const TABS = ['概覽', 'eSIM 設定', '金流設定', '品牌設定'] as const
type Tab = typeof TABS[number]

const GATEWAY_LABEL: Record<string, string> = {
  tappay_credit: '信用卡 (TapPay)',
  tappay_linepay: 'LINE Pay (TapPay)',
}

// ─── Main Page ────────────────────────────────────────────────────

export default function AdminDetailPage() {
  const router = useRouter()
  const params = useParams()
  const adminId = params.id as string

  const [admin, setAdmin] = useState<AdminDetail | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [esimConfig, setEsimConfig] = useState<EsimConfig>(null)
  const [paymentConfigs, setPaymentConfigs] = useState<PaymentConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('概覽')

  const load = useCallback(async () => {
    setLoading(true)
    const [adminRes, statsRes, esimRes, payRes] = await Promise.all([
      fetch(`/api/platform/admins/${adminId}`),
      fetch(`/api/platform/admins/${adminId}/stats`),
      fetch(`/api/platform/admins/${adminId}/esim-config`),
      fetch(`/api/platform/admins/${adminId}/payment-config`),
    ])

    if (adminRes.status === 401) { router.replace('/platform/login'); return }
    if (adminRes.status === 403 || adminRes.status === 404) { router.replace('/platform/admins'); return }

    const [adminData, statsData, esimData, payData] = await Promise.all([
      adminRes.json(),
      statsRes.json(),
      esimRes.json(),
      payRes.json(),
    ])

    setAdmin(adminData.admin)
    setStats(statsData)
    setEsimConfig(esimData.config)
    setPaymentConfigs(payData.configs ?? [])
    setLoading(false)
  }, [adminId, router])

  useEffect(() => { load() }, [load])

  if (loading) return <div className="text-gray-400 text-sm p-8">載入中…</div>
  if (!admin) return null

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.push('/platform/admins')} className="text-gray-400 hover:text-gray-600 text-sm">
          ← 帳號管理
        </button>
        <span className="text-gray-300">/</span>
        <h1 className="text-2xl font-bold">{admin.name}</h1>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${admin.isActive ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
          {admin.isActive ? '啟用' : '停用'}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b mb-6">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${activeTab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab Contents */}
      {activeTab === '概覽' && <OverviewTab admin={admin} stats={stats} />}
      {activeTab === 'eSIM 設定' && <EsimConfigTab adminId={adminId} config={esimConfig} onSaved={load} />}
      {activeTab === '金流設定' && <PaymentConfigTab adminId={adminId} configs={paymentConfigs} onSaved={load} />}
      {activeTab === '品牌設定' && <BrandConfigTab admin={admin} onSaved={load} />}
    </div>
  )
}

// ─── Overview Tab ─────────────────────────────────────────────────

function OverviewTab({ admin, stats }: { admin: AdminDetail; stats: Stats | null }) {
  const statCards = stats ? [
    { label: '會員數', value: stats.totalUsers.toLocaleString() },
    { label: '社群總數', value: (stats.pendingGroups + stats.approvedGroups).toLocaleString() },
    { label: '已核准社群', value: stats.approvedGroups.toLocaleString() },
    { label: '訂單數', value: stats.totalOrders.toLocaleString() },
    { label: '總營收', value: `NT$ ${stats.totalRevenue.toLocaleString()}` },
    { label: '待結算分潤', value: `NT$ ${Number(stats.pendingCommissions).toLocaleString()}` },
    { label: '待審社群', value: stats.pendingGroups.toLocaleString() },
    { label: 'eSIM 補發中', value: stats.esimPendingOrders.toLocaleString() },
  ] : []

  return (
    <div className="space-y-6">
      {/* Basic info */}
      <div className="bg-white rounded-2xl border shadow-sm p-5">
        <h2 className="font-semibold text-sm text-gray-500 mb-3">基本資料</h2>
        <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <InfoRow label="電子郵件" value={admin.email} />
          <InfoRow label="角色" value="Platform Admin" />
          <InfoRow label="讓利上限" value={`${Math.round(Number(admin.maxRebateRate) * 100)}%`} />
          <InfoRow label="建立時間" value={new Date(admin.createdAt).toLocaleDateString('zh-TW')} />
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div>
          <h2 className="font-semibold text-sm text-gray-500 mb-3">數據統計</h2>
          <div className="grid grid-cols-4 gap-3">
            {statCards.map(c => (
              <div key={c.label} className="bg-white rounded-2xl border shadow-sm p-4">
                <p className="text-xs text-gray-400 mb-1">{c.label}</p>
                <p className="text-xl font-bold text-gray-800">{c.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-gray-400">{label}：</span>
      <span className="text-gray-800 font-medium">{value}</span>
    </div>
  )
}

// ─── eSIM Config Tab ──────────────────────────────────────────────

function EsimConfigTab({
  adminId,
  config,
  onSaved,
}: {
  adminId: string
  config: EsimConfig
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    provider: config?.provider ?? 'worldmove',
    apiUrl: config?.apiUrl ?? '',
    merchantId: config?.merchantId ?? '',
    deptId: config?.deptId ?? '',
    token: config?.token ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMsg(null)
    const r = await fetch(`/api/platform/admins/${adminId}/esim-config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    }).then(x => x.json())
    setSaving(false)
    if (r.ok) {
      setMsg({ ok: true, text: '✅ 已儲存' })
      onSaved()
    } else {
      setMsg({ ok: false, text: `❌ ${r.error}` })
    }
  }

  return (
    <div className="max-w-xl">
      <div className="bg-white rounded-2xl border shadow-sm p-5">
        <h2 className="font-semibold mb-1">世界移動 eSIM API 設定</h2>
        <p className="text-xs text-gray-400 mb-4">此設定將覆蓋系統預設環境變數，僅適用於此 Platform Admin。</p>

        {config && (
          <p className="text-xs text-gray-400 mb-4">
            上次更新：{new Date(config.updatedAt).toLocaleString('zh-TW')}
          </p>
        )}

        <form onSubmit={handleSave} className="space-y-3">
          {[
            { label: 'API URL', key: 'apiUrl', placeholder: 'https://api.worldmobile.com.tw/...' },
            { label: 'Merchant ID', key: 'merchantId', placeholder: '' },
            { label: 'Dept ID', key: 'deptId', placeholder: '' },
          ].map(f => (
            <div key={f.key}>
              <label className="text-xs text-gray-500 block mb-1">{f.label}</label>
              <input
                type="text"
                value={form[f.key as keyof typeof form]}
                onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                required
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ))}
          <div>
            <label className="text-xs text-gray-500 block mb-1">Token</label>
            <input
              type="password"
              value={form.token}
              onChange={e => setForm(p => ({ ...p, token: e.target.value }))}
              placeholder={config ? '留空保留現有 Token' : '輸入 API Token'}
              className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {config && (
              <p className="text-xs text-gray-400 mt-1">現有 Token：{config.token}</p>
            )}
          </div>

          {msg && <p className={`text-sm ${msg.ok ? 'text-green-600' : 'text-red-500'}`}>{msg.text}</p>}

          <button
            type="submit"
            disabled={saving}
            className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {saving ? '儲存中…' : '儲存設定'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── Payment Config Tab ───────────────────────────────────────────

function PaymentConfigTab({
  adminId,
  configs,
  onSaved,
}: {
  adminId: string
  configs: PaymentConfig[]
  onSaved: () => void
}) {
  const gateways = ['tappay_credit', 'tappay_linepay']

  return (
    <div className="space-y-4 max-w-xl">
      <p className="text-xs text-gray-400">各金流設定將覆蓋系統預設環境變數，僅適用於此 Platform Admin。</p>
      {gateways.map(gw => {
        const existing = configs.find(c => c.gateway === gw) ?? null
        return (
          <GatewayCard
            key={gw}
            adminId={adminId}
            gateway={gw}
            existing={existing}
            onSaved={onSaved}
          />
        )
      })}
    </div>
  )
}

function GatewayCard({
  adminId,
  gateway,
  existing,
  onSaved,
}: {
  adminId: string
  gateway: string
  existing: PaymentConfig | null
  onSaved: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [form, setForm] = useState({
    partnerKey: existing?.partnerKey ?? '',
    merchantId: existing?.merchantId ?? '',
    env: existing?.env ?? 'sandbox',
  })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMsg(null)
    const r = await fetch(`/api/platform/admins/${adminId}/payment-config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gateway, ...form }),
    }).then(x => x.json())
    setSaving(false)
    if (r.ok) {
      setMsg({ ok: true, text: '✅ 已儲存' })
      setExpanded(false)
      onSaved()
    } else {
      setMsg({ ok: false, text: `❌ ${r.error}` })
    }
  }

  return (
    <div className="bg-white rounded-2xl border shadow-sm p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-sm">{GATEWAY_LABEL[gateway] ?? gateway}</p>
          {existing ? (
            <p className="text-xs text-gray-400 mt-0.5">
              Merchant: {existing.merchantId} · {existing.env === 'production' ? '🟢 正式' : '🟡 沙箱'} · 更新：{new Date(existing.updatedAt).toLocaleDateString('zh-TW')}
            </p>
          ) : (
            <p className="text-xs text-gray-400 mt-0.5">尚未設定（使用系統預設）</p>
          )}
        </div>
        <button
          onClick={() => setExpanded(p => !p)}
          className="text-xs text-blue-600 hover:underline"
        >
          {expanded ? '收起' : (existing ? '編輯' : '設定')}
        </button>
      </div>

      {expanded && (
        <form onSubmit={handleSave} className="mt-4 space-y-3 border-t pt-4">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Partner Key</label>
            <input
              type="password"
              value={form.partnerKey}
              onChange={e => setForm(p => ({ ...p, partnerKey: e.target.value }))}
              placeholder={existing ? '留空保留現有 Key' : '輸入 Partner Key'}
              required={!existing}
              className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {existing && <p className="text-xs text-gray-400 mt-1">現有 Key：{existing.partnerKey}</p>}
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Merchant ID</label>
            <input
              type="text"
              value={form.merchantId}
              onChange={e => setForm(p => ({ ...p, merchantId: e.target.value }))}
              required
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">環境</label>
            <select
              value={form.env}
              onChange={e => setForm(p => ({ ...p, env: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="sandbox">沙箱（測試）</option>
              <option value="production">正式環境</option>
            </select>
          </div>

          {msg && <p className={`text-sm ${msg.ok ? 'text-green-600' : 'text-red-500'}`}>{msg.text}</p>}

          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50">
              {saving ? '儲存中…' : '儲存'}
            </button>
            <button type="button" onClick={() => setExpanded(false)} className="bg-gray-100 text-gray-600 px-4 py-2 rounded-lg text-sm">
              取消
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

// ─── Brand Config Tab ─────────────────────────────────────────────

function BrandConfigTab({ admin, onSaved }: { admin: AdminDetail; onSaved: () => void }) {
  const [form, setForm] = useState({
    brandName: admin.brandName ?? '',
    tenantSlug: admin.tenantSlug ?? '',
    logoUrl: admin.logoUrl ?? '',
    primaryColor: admin.primaryColor ?? '#3B82F6',
  })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadError(null)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('adminId', admin.id)
    const r = await fetch('/api/platform/upload/logo', { method: 'POST', body: fd }).then(x => x.json())
    setUploading(false)
    if (r.ok) {
      setForm(p => ({ ...p, logoUrl: r.url }))
    } else {
      setUploadError(r.error ?? '上傳失敗')
    }
    // Reset input so the same file can be re-selected
    e.target.value = ''
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMsg(null)
    const r = await fetch(`/api/platform/admins/${admin.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    }).then(x => x.json())
    setSaving(false)
    if (r.ok) {
      setMsg({ ok: true, text: '✅ 品牌設定已儲存' })
      onSaved()
    } else {
      setMsg({ ok: false, text: `❌ ${r.error}` })
    }
  }

  return (
    <div className="max-w-xl">
      <div className="bg-white rounded-2xl border shadow-sm p-5">
        <h2 className="font-semibold mb-1">白牌品牌設定</h2>
        <p className="text-xs text-gray-400 mb-4">設定此 Platform Admin 的品牌識別資訊。</p>

        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">品牌名稱</label>
            <input
              type="text"
              value={form.brandName}
              onChange={e => setForm(p => ({ ...p, brandName: e.target.value }))}
              placeholder="例：Bii旅"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Slug（URL 識別碼）</label>
            <input
              type="text"
              value={form.tenantSlug}
              onChange={e => setForm(p => ({ ...p, tenantSlug: e.target.value.toLowerCase().replace(/\s+/g, '-') }))}
              placeholder="例：bii-travel"
              className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Logo 欄位：支援直接上傳或貼網址 */}
          <div>
            <label className="text-xs text-gray-500 block mb-1">Logo 圖片</label>

            {/* 上傳區 */}
            <div className="flex items-center gap-2 mb-2">
              <label className={`inline-flex items-center gap-1.5 cursor-pointer border rounded-lg px-3 py-2 text-xs font-medium transition
                ${uploading ? 'opacity-50 cursor-not-allowed bg-gray-50 text-gray-400' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
                {uploading ? '上傳中…' : '選擇圖片上傳'}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  disabled={uploading}
                  onChange={handleLogoUpload}
                  className="hidden"
                />
              </label>
              <span className="text-xs text-gray-400">PNG / JPG / WebP / SVG，最大 2 MB</span>
            </div>

            {uploadError && (
              <p className="text-xs text-red-500 mb-2">{uploadError}</p>
            )}

            {/* 或直接輸入 URL */}
            <input
              type="url"
              value={form.logoUrl}
              onChange={e => setForm(p => ({ ...p, logoUrl: e.target.value }))}
              placeholder="https://... （或直接上傳）"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            {/* 預覽 */}
            {form.logoUrl && (
              <div className="mt-2 flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={form.logoUrl} alt="Logo preview" className="h-12 w-auto object-contain rounded border bg-gray-50 p-1" />
                <button
                  type="button"
                  onClick={() => setForm(p => ({ ...p, logoUrl: '' }))}
                  className="text-xs text-gray-400 hover:text-red-500 transition"
                >
                  移除
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">主題色</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={form.primaryColor}
                onChange={e => setForm(p => ({ ...p, primaryColor: e.target.value }))}
                className="h-9 w-16 border rounded-lg cursor-pointer"
              />
              <input
                type="text"
                value={form.primaryColor}
                onChange={e => setForm(p => ({ ...p, primaryColor: e.target.value }))}
                placeholder="#3B82F6"
                className="border rounded-lg px-3 py-2 text-sm font-mono w-32 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {msg && <p className={`text-sm ${msg.ok ? 'text-green-600' : 'text-red-500'}`}>{msg.text}</p>}

          <button
            type="submit"
            disabled={saving || uploading}
            className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {saving ? '儲存中…' : '儲存品牌設定'}
          </button>
        </form>
      </div>
    </div>
  )
}
