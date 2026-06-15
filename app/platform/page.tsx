'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type MonthlyRevenue = { month: string; revenue: number; grossProfit: number }

type RecentOrder = {
  id: string
  orderNo: string
  totalPaid: number
  status: string
  createdAt: string
  userName: string
  productName: string
}

type Stats = {
  role: string
  totalUsers: number
  totalOrders: number
  totalRevenue: number
  pendingGroups: number
  totalGroupOwners: number
  totalProducts: number
  paymentConfigured: boolean
  pendingCommissions: number
  esimPendingOrders: number
  monthlyRevenue: MonthlyRevenue[]
  recentOrders: RecentOrder[]
  // 毛利相關
  eligibleRevenue: number
  totalCost: number
  commissionPaid: number
  grossProfit: number
  marginRate: number
  ordersIncluded: number
  ordersExcluded: number
  riskAlerts: {
    threshold: number
    systemAlerts: { count: number; examples: { title: string; orderNo: string; at: string }[] }
    lossOrders: { count: number; examples: { id: string; orderNo: string; totalPaid: number; cost: number; loss: number }[] }
    lowMarginProducts: { count: number; examples: { id: string; name: string; sellPrice: number; costPrice: number; marginRate: number }[] }
  }
}

const ORDER_STATUS: Record<string, { label: string; cls: string }> = {
  PAID:          { label: '已付款',     cls: 'bg-blue-50 text-blue-600' },
  COMPLETED:     { label: '已完成發送', cls: 'bg-green-50 text-green-600' },
  PENDING:       { label: '待付款',     cls: 'bg-yellow-50 text-yellow-600' },
  PROCESSING:    { label: '待付款',     cls: 'bg-yellow-50 text-yellow-600' },
  FAILED:        { label: '付款失敗',   cls: 'bg-red-50 text-red-500' },
  // ESIM_PENDING 已不再產生新訂單；保留標籤相容歷史資料
  ESIM_PENDING:  { label: '待發送',     cls: 'bg-orange-50 text-orange-600' },
  CANCELLED:     { label: '已取消',     cls: 'bg-gray-100 text-gray-400' },
  REFUNDED:      { label: '已退款',     cls: 'bg-red-50 text-red-500' },
}

function MiniChart({ data }: { data: MonthlyRevenue[] }) {
  // 每個月並排顯示：藍 = 營收, 綠 = 毛利
  const max = Math.max(...data.map(d => Math.max(d.revenue, d.grossProfit)), 1)
  return (
    <div className="flex items-end gap-1.5 h-16">
      {data.map((d, i) => {
        const revPct    = max === 0 ? 0 : (d.revenue / max) * 100
        const profitPct = max === 0 ? 0 : (Math.max(d.grossProfit, 0) / max) * 100
        const isLast = i === data.length - 1
        return (
          <div key={d.month} className="flex-1 flex items-end gap-0.5 group relative">
            <div
              className={`flex-1 rounded-t-sm transition-all ${isLast ? 'bg-blue-600' : 'bg-blue-200'}`}
              style={{ height: `${Math.max(revPct, 4)}%`, minHeight: 3 }}
            />
            <div
              className={`flex-1 rounded-t-sm transition-all ${isLast ? 'bg-emerald-600' : 'bg-emerald-200'}`}
              style={{ height: `${Math.max(profitPct, 2)}%`, minHeight: 2 }}
            />
            {/* tooltip */}
            <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap pointer-events-none z-10">
              {d.month}　營收 NT${d.revenue.toLocaleString()}　毛利 NT${d.grossProfit.toLocaleString()}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function StatCard({ icon, label, value, sub, href }: { icon: React.ReactNode; label: string; value: string; sub?: string; href?: string }) {
  const inner = (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-all flex items-center gap-4">
      <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0 text-blue-600">
        {icon}
      </div>
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-xl font-bold text-gray-800 leading-tight">{value}</p>
        {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
  return href ? <Link href={href}>{inner}</Link> : inner
}

export default function PlatformDashboard() {
  const router = useRouter()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/platform/dashboard')
      .then(async r => {
        if (r.status === 401) { router.replace('/platform/login'); return }
        if (!r.ok) {
          // 後端 500 等錯誤時不要靜默變空白：把訊息顯示出來、可重試。
          let msg = `伺服器回應錯誤（${r.status}）`
          try { const e = await r.json(); if (e?.error) msg = e.error } catch { /* 非 JSON 回應 */ }
          throw new Error(msg)
        }
        const d = await r.json()
        if (!cancelled) setStats(d)
      })
      .catch(e => { if (!cancelled) setError(e?.message || '儀表板載入失敗，請重新整理；若持續發生請重新登入。') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [router])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400">載入中…</p>
        </div>
      </div>
    )
  }
  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="bg-white border border-red-100 rounded-2xl shadow-sm p-6 max-w-sm w-full text-center">
          <div className="w-11 h-11 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <p className="text-sm text-gray-700 whitespace-pre-wrap break-words text-left">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition"
          >
            重新整理
          </button>
        </div>
      </div>
    )
  }
  if (!stats) return null

  const prevMonthRevenue = stats.monthlyRevenue.length >= 2
    ? stats.monthlyRevenue[stats.monthlyRevenue.length - 2].revenue
    : 0
  const thisMonthRevenue = stats.monthlyRevenue.length >= 1
    ? stats.monthlyRevenue[stats.monthlyRevenue.length - 1].revenue
    : 0
  const revenueChange = prevMonthRevenue === 0
    ? 0
    : Math.round(((thisMonthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100)
  const currentMonth = stats.monthlyRevenue[stats.monthlyRevenue.length - 1]?.month ?? ''

  // 開站進度：每個白牌（平台商）開站要做的三步。Super Admin 不顯示（這些是租戶層的設定）。
  const setupSteps = [
    { label: '匯入商品',       done: stats.totalProducts > 0,     href: '/platform/products', cta: '前往匯入' },
    { label: '升級社群主',     done: stats.totalGroupOwners > 0,  href: '/platform/users',    cta: '前往設定' },
    { label: '設定金流 / 外觀', done: stats.paymentConfigured,     href: '/platform/liff',     cta: '前往設定' },
  ]
  const setupDone = setupSteps.filter(s => s.done).length
  const showSetup = stats.role !== 'SUPER_ADMIN' && setupDone < setupSteps.length

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">儀表板</h1>
          <p className="text-sm text-gray-400 mt-0.5">歡迎回來，這是今日的平台運行概況。</p>
        </div>
        <div className="flex gap-2">
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm text-gray-500 shadow-sm">
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            最近 6 個月
          </div>
          <Link
            href="/platform/orders"
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-4 py-2 text-sm font-medium shadow-sm transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            查看訂單
          </Link>
        </div>
      </div>

      {/* 開站進度：平台商開站三步，做完打勾、全部完成後自動隱藏。Super Admin 不顯示。 */}
      {showSetup && (
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-base font-semibold text-gray-800">開站進度</p>
            <span className="text-sm font-semibold text-blue-600">{setupDone}/{setupSteps.length} 完成</span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5 mb-3">完成這幾步就能正式開始營業。</p>
          {/* 進度條 */}
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-4">
            <div
              className="h-full bg-blue-600 rounded-full transition-all"
              style={{ width: `${(setupDone / setupSteps.length) * 100}%` }}
            />
          </div>
          {/* 步驟清單 */}
          <ul className="space-y-2.5">
            {setupSteps.map((s, i) => (
              <li key={s.label} className="flex items-center gap-3">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${s.done ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
                  {s.done ? (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <span className="text-xs font-bold">{i + 1}</span>
                  )}
                </span>
                <span className={`flex-1 text-sm ${s.done ? 'text-gray-400 line-through' : 'text-gray-700 font-medium'}`}>{s.label}</span>
                {s.done ? (
                  <span className="text-xs font-medium text-emerald-600">已完成</span>
                ) : (
                  <Link href={s.href} className="text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg px-3 py-1.5 transition">
                    {s.cta}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 風險警示區：系統異常 + 虧損訂單 + 低毛利商品。皆 0 時整區不顯示。 */}
      {(stats.riskAlerts.systemAlerts.count > 0 || stats.riskAlerts.lossOrders.count > 0 || stats.riskAlerts.lowMarginProducts.count > 0) && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <h2 className="text-sm font-bold text-red-700">需注意</h2>
          </div>
          {/* 系統異常最優先：開卡/金流驗真/分潤/WM 失敗（近 24h）*/}
          {stats.riskAlerts.systemAlerts.count > 0 && (
            <div className="bg-white rounded-xl border border-red-200 p-3 mb-4">
              <div className="flex items-baseline justify-between mb-2">
                <p className="text-sm font-semibold text-red-700">系統異常（近 24 小時）</p>
                <span className="text-lg font-bold text-red-600">{stats.riskAlerts.systemAlerts.count} 筆</span>
              </div>
              <ul className="space-y-1">
                {stats.riskAlerts.systemAlerts.examples.map((a, i) => (
                  <li key={i} className="flex items-center justify-between text-xs text-gray-600">
                    <span className="font-semibold text-red-600">{a.title}</span>
                    <span className="text-gray-400">訂單 {a.orderNo} · {new Date(a.at).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  </li>
                ))}
                {stats.riskAlerts.systemAlerts.count > stats.riskAlerts.systemAlerts.examples.length && (
                  <li className="text-xs text-gray-400">…還有 {stats.riskAlerts.systemAlerts.count - stats.riskAlerts.systemAlerts.examples.length} 筆</li>
                )}
              </ul>
            </div>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {stats.riskAlerts.lossOrders.count > 0 && (
              <div className="bg-white rounded-xl border border-red-100 p-3">
                <div className="flex items-baseline justify-between mb-2">
                  <p className="text-sm font-semibold text-gray-700">虧損訂單（實付 &lt; 成本）</p>
                  <span className="text-lg font-bold text-red-600">{stats.riskAlerts.lossOrders.count} 筆</span>
                </div>
                <ul className="space-y-1">
                  {stats.riskAlerts.lossOrders.examples.map(o => (
                    <li key={o.id} className="flex items-center justify-between text-xs text-gray-500">
                      <span className="font-mono">{o.orderNo}</span>
                      <span>實付 NT${o.totalPaid.toLocaleString()} · 成本 NT${o.cost.toLocaleString()} · <span className="text-red-600 font-semibold">虧 NT${o.loss.toLocaleString()}</span></span>
                    </li>
                  ))}
                  {stats.riskAlerts.lossOrders.count > stats.riskAlerts.lossOrders.examples.length && (
                    <li className="text-xs text-gray-400">…還有 {stats.riskAlerts.lossOrders.count - stats.riskAlerts.lossOrders.examples.length} 筆</li>
                  )}
                </ul>
              </div>
            )}
            {stats.riskAlerts.lowMarginProducts.count > 0 && (
              <div className="bg-white rounded-xl border border-red-100 p-3">
                <div className="flex items-baseline justify-between mb-2">
                  <p className="text-sm font-semibold text-gray-700">毛利 &lt; {(stats.riskAlerts.threshold * 100).toFixed(0)}% 商品</p>
                  <span className="text-lg font-bold text-red-600">{stats.riskAlerts.lowMarginProducts.count} 項</span>
                </div>
                <ul className="space-y-1">
                  {stats.riskAlerts.lowMarginProducts.examples.map(p => (
                    <li key={p.id} className="flex items-center justify-between text-xs text-gray-500 gap-2">
                      <span className="truncate">{p.name}</span>
                      <span className="whitespace-nowrap">售 NT${p.sellPrice.toLocaleString()} / 成本 NT${p.costPrice.toLocaleString()} · <span className={p.marginRate < 0 ? 'text-red-600 font-semibold' : 'text-orange-600 font-semibold'}>{(p.marginRate * 100).toFixed(0)}%</span></span>
                    </li>
                  ))}
                  {stats.riskAlerts.lowMarginProducts.count > stats.riskAlerts.lowMarginProducts.examples.length && (
                    <li className="text-xs text-gray-400">…還有 {stats.riskAlerts.lowMarginProducts.count - stats.riskAlerts.lowMarginProducts.examples.length} 項，請見商品管理</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Top KPI row: 毛利為核心 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs text-gray-400">累計營收</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">NT${stats.totalRevenue.toLocaleString()}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">用戶實付總額</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs text-gray-400">累計成本</p>
          <p className="text-2xl font-bold text-gray-700 mt-1">NT${stats.totalCost.toLocaleString()}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">供應商成本</p>
        </div>
        <div className="bg-white rounded-2xl border-2 border-emerald-100 p-4 shadow-sm">
          <p className="text-xs text-emerald-700 font-medium">累計毛利</p>
          <p className={`text-2xl font-bold mt-1 ${stats.grossProfit < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
            NT${stats.grossProfit.toLocaleString()}
          </p>
          <p className="text-[10px] text-gray-400 mt-0.5">營收 − 成本 − 已產生分潤</p>
        </div>
        <div className="bg-white rounded-2xl border-2 border-emerald-100 p-4 shadow-sm">
          <p className="text-xs text-emerald-700 font-medium">毛利率</p>
          <p className={`text-2xl font-bold mt-1 ${stats.marginRate < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
            {stats.ordersIncluded > 0 ? `${(stats.marginRate * 100).toFixed(1)}%` : '—'}
          </p>
          <p className="text-[10px] text-gray-400 mt-0.5">
            納入 {stats.ordersIncluded} 筆
            {stats.ordersExcluded > 0 && (
              <span className="text-amber-600 ml-1" title="這些訂單建立於 unitCost 上線前">
                · 不含 {stats.ordersExcluded} 筆
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Revenue + Stats Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue Card */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Revenue & Profit</p>
              <p className="text-sm font-medium text-gray-600 mt-0.5">營收與毛利趨勢</p>
              <p className="text-3xl font-bold text-blue-600 mt-1">
                NT${stats.totalRevenue.toLocaleString()}
              </p>
              <div className="flex items-center gap-1.5 mt-1">
                <span className={`text-xs font-medium flex items-center gap-0.5 ${revenueChange >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {revenueChange >= 0
                    ? <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>
                    : <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                  }
                  {Math.abs(revenueChange)}%
                </span>
                <span className="text-xs text-gray-400">vs 上個月</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5 text-[10px]">
              <span className="flex items-center gap-1 text-gray-500"><span className="w-2.5 h-2.5 rounded-sm bg-blue-600 inline-block"/>營收</span>
              <span className="flex items-center gap-1 text-gray-500"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-600 inline-block"/>毛利</span>
            </div>
          </div>
          {/* Bar chart */}
          <div>
            <div className="flex justify-between text-[10px] text-gray-400 mb-1">
              {stats.monthlyRevenue.map(d => (
                <span key={d.month} className="flex-1 text-center">{d.month}</span>
              ))}
            </div>
            <MiniChart data={stats.monthlyRevenue} />
          </div>
          <p className="text-[10px] text-gray-400 mt-2 text-right">{currentMonth}本月營收 NT${thisMonthRevenue.toLocaleString()}</p>
        </div>

        {/* Right stat cards */}
        <div className="flex flex-col gap-4">
          <StatCard
            href="/platform/users"
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2h5"/><circle cx="12" cy="8" r="4"/></svg>}
            label="總會員數"
            value={stats.totalUsers.toLocaleString()}
          />
          <StatCard
            href="/platform/orders"
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>}
            label="總訂單數"
            value={stats.totalOrders.toLocaleString()}
          />
          <StatCard
            href="/platform/groups"
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2h5"/><circle cx="9" cy="8" r="4"/><path strokeLinecap="round" strokeLinejoin="round" d="M16 3.13a4 4 0 010 7.75"/></svg>}
            label="社群主人數"
            value={stats.totalGroupOwners.toLocaleString()}
          />
          <StatCard
            href="/platform/commissions"
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"/></svg>}
            label="待結算分潤"
            value={`NT$${stats.pendingCommissions.toLocaleString()}`}
            sub="尚未付給社群主"
          />
        </div>
      </div>

      {/* Alert Cards */}
      {(stats.pendingGroups > 0 || stats.esimPendingOrders > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {stats.pendingGroups > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-600 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-3-3h-2M9 20H4v-2a3 3 0 013-3h2m4-4a4 4 0 10-8 0 4 4 0 008 0zm6 0a3 3 0 10-6 0 3 3 0 006 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-amber-900">待審社群</p>
                <p className="text-sm text-amber-700">共有 <strong>{stats.pendingGroups}</strong> 個社群申請案需要您的審核。</p>
              </div>
              <Link
                href="/platform/groups?status=PENDING"
                className="flex-shrink-0 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition flex items-center gap-1"
              >
                立即處理
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          )}
          {stats.esimPendingOrders > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-red-600 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-red-800">付款成功・尚未發卡</p>
                <p className="text-sm text-red-600">共有 <strong>{stats.esimPendingOrders}</strong> 張已付款但尚未發送 eSIM，請確認或補發。</p>
              </div>
              <Link
                href="/platform/orders?status=PAID"
                className="flex-shrink-0 bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition flex items-center gap-1"
              >
                查看詳情
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Recent Orders */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800 text-sm">最新訂單與狀態</h2>
          <Link href="/platform/orders" className="text-xs text-blue-600 hover:underline">查看全部</Link>
        </div>
        {stats.recentOrders.length === 0 ? (
          <p className="text-center text-gray-400 py-8 text-sm">尚無訂單資料</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['訂單編號', '會員名稱', '產品', '金額', '狀態'].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {stats.recentOrders.map(o => {
                const s = ORDER_STATUS[o.status] ?? { label: o.status, cls: 'bg-gray-100 text-gray-500' }
                const initials = o.userName.slice(0, 2).toUpperCase()
                return (
                  <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5 font-mono text-xs text-gray-500">#{o.orderNo ?? o.id.slice(-8).toUpperCase()}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {initials}
                        </div>
                        <span className="font-medium text-gray-700">{o.userName}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-gray-600">{o.productName}</td>
                    <td className="px-5 py-3.5 font-semibold text-gray-800">NT$ {o.totalPaid.toLocaleString()}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full ${s.cls}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 opacity-70" />
                        {s.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
