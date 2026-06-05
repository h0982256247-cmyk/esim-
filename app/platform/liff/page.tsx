'use client'

import { useState, useEffect } from 'react'
import {
  HOME_TEMPLATE_META, PRODUCTS_TEMPLATE_META,
} from '@/components/liff/templates/registry'
import type { HomeTemplate, ProductsTemplate } from '@/components/liff/TenantContext'

const LIFF_PAGES = [
  { path: '/',         label: '首頁',    icon: '🏠', desc: '主入口頁面' },
  { path: '/products', label: '商品列表', icon: '📱', desc: 'LIFF Endpoint 填這個' },
  { path: '/orders',   label: '我的訂單', icon: '🧾', desc: '訂單查詢' },
  { path: '/profile',  label: '個人資料', icon: '👤', desc: '會員資料設定' },
  { path: '/coupons',  label: '優惠券',   icon: '🎫', desc: '優惠券列表' },
  { path: '/group',    label: '加入社群', icon: '🏘️', desc: '社群加入頁' },
  { path: '/support',  label: '客服',     icon: '💬', desc: '客服聯繫頁' },
]

// Template preview colours per key
const HOME_PREVIEW: Record<string, { bg: string; label: string }> = {
  landmark: { bg: 'linear-gradient(160deg,#fff9ec,#fff)', label: '白底地標插畫' },
  gradient: { bg: 'linear-gradient(160deg,#0f0c29,#302b63,#24243e)', label: '深色極光漸層' },
  minimal:  { bg: 'linear-gradient(160deg,#fafafa,#f3f4f6)', label: '極簡品牌' },
}
const PRODUCTS_PREVIEW: Record<string, { accent: string; rows: number[] }> = {
  classic:  { accent: '#0284c7', rows: [2, 3, 2] },
  magazine: { accent: '#f59e0b', rows: [1, 2] },
  compact:  { accent: '#6366f1', rows: [4, 4, 4] },
}

export default function LiffSettingsPage() {
  const [baseUrl, setBaseUrl] = useState('')
  const [liffId, setLiffId] = useState('')
  const [copied, setCopied] = useState<string | null>(null)

  // Template state
  const [homeTemplate, setHomeTemplate] = useState<HomeTemplate | null>(null)
  const [productsTemplate, setProductsTemplate] = useState<ProductsTemplate | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)

  useEffect(() => {
    setBaseUrl(window.location.origin)
    setLiffId(process.env.NEXT_PUBLIC_LIFF_ID ?? '')
    fetch('/api/platform/appearance').then(r => r.json()).then(d => {
      if (d.homeTemplate) setHomeTemplate(d.homeTemplate)
      if (d.productsTemplate) setProductsTemplate(d.productsTemplate)
    })
  }, [])

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 1500)
  }

  async function saveTemplates() {
    setSaving(true)
    setSaveMsg(null)
    try {
      const res = await fetch('/api/platform/appearance', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ homeTemplate, productsTemplate }),
      })
      setSaveMsg(res.ok ? 'saved' : 'error')
    } catch {
      setSaveMsg('error')
    } finally {
      setSaving(false)
      setTimeout(() => setSaveMsg(null), 2500)
    }
  }

  const CopyBtn = ({ text, id }: { text: string; id: string }) => (
    <button
      onClick={() => copy(text, id)}
      className="ml-2 text-xs text-gray-400 hover:text-blue-600 transition px-1.5 py-0.5 rounded hover:bg-blue-50"
    >
      {copied === id ? '✓ 已複製' : '複製'}
    </button>
  )

  const endpointUrl = `${baseUrl}/products`
  const liffUrl     = liffId ? `https://liff.line.me/${liffId}` : '（請先設定 NEXT_PUBLIC_LIFF_ID）'

  return (
    <div className="max-w-3xl space-y-8">
      <h1 className="text-2xl font-bold">LIFF 前台設定</h1>

      {/* ─── 前台外觀 / 模板選擇 ─── */}
      <section className="bg-white rounded-2xl border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b bg-gray-50 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-800">前台外觀模板</h2>
            <p className="text-xs text-gray-400 mt-0.5">選擇首頁載入畫面與商品頁的視覺風格</p>
          </div>
          <button
            onClick={saveTemplates}
            disabled={saving}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition
              ${saving ? 'bg-gray-100 text-gray-400 cursor-not-allowed' :
                saveMsg === 'saved' ? 'bg-green-100 text-green-700' :
                saveMsg === 'error' ? 'bg-red-100 text-red-600' :
                'bg-blue-600 text-white hover:bg-blue-700'}`}
          >
            {saving ? '儲存中…' : saveMsg === 'saved' ? '✓ 已儲存' : saveMsg === 'error' ? '儲存失敗' : '儲存設定'}
          </button>
        </div>

        <div className="p-6 space-y-8">
          {/* 首頁 Splash 選擇 */}
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-3">首頁載入畫面</p>
            <div className="grid grid-cols-3 gap-3">
              {HOME_TEMPLATE_META.map(t => {
                const preview = HOME_PREVIEW[t.key]
                const active = (homeTemplate ?? 'landmark') === t.key
                return (
                  <button
                    key={t.key}
                    onClick={() => setHomeTemplate(t.key)}
                    className={`rounded-xl border-2 overflow-hidden text-left transition-all
                      ${active ? 'border-blue-500 shadow-md shadow-blue-100' : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    {/* 縮圖預覽 */}
                    <div
                      className="h-24 w-full relative flex flex-col items-center justify-center gap-1.5"
                      style={{ background: preview.bg }}
                    >
                      {t.key === 'landmark' && (
                        <>
                          <div className="w-6 h-6 rounded-full bg-white/80 flex items-center justify-center shadow-sm text-xs">🐝</div>
                          <div className="flex gap-1">
                            {['🗼','🏔️','🕐'].map(e => (
                              <span key={e} className="text-xs opacity-60">{e}</span>
                            ))}
                          </div>
                        </>
                      )}
                      {t.key === 'gradient' && (
                        <>
                          <div className="w-8 h-8 rounded-full border border-white/30 bg-white/10 flex items-center justify-center shadow-inner">
                            <span className="text-white text-sm">✦</span>
                          </div>
                          <div className="flex gap-0.5">
                            {[0,1,2].map(i => (
                              <div key={i} className="w-1.5 h-1.5 rounded-full bg-indigo-400/70" style={{ animationDelay: `${i*0.2}s` }} />
                            ))}
                          </div>
                        </>
                      )}
                      {t.key === 'minimal' && (
                        <>
                          <div className="w-8 h-8 rounded-full border border-gray-200 bg-white shadow-sm flex items-center justify-center">
                            <span className="text-xs">🐝</span>
                          </div>
                          <div className="w-8 h-0.5 bg-gray-300 rounded" />
                          <div className="w-12 h-1.5 bg-gray-200 rounded-full" />
                        </>
                      )}
                      {active && (
                        <div className="absolute top-2 right-2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        </div>
                      )}
                    </div>
                    {/* 標籤 */}
                    <div className="px-3 py-2">
                      <p className="text-xs font-semibold text-gray-800">{t.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5 leading-tight">{t.desc}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 商品頁選擇 */}
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-3">商品頁版型</p>
            <div className="grid grid-cols-3 gap-3">
              {PRODUCTS_TEMPLATE_META.map(t => {
                const preview = PRODUCTS_PREVIEW[t.key]
                const active = (productsTemplate ?? 'classic') === t.key
                return (
                  <button
                    key={t.key}
                    onClick={() => setProductsTemplate(t.key)}
                    className={`rounded-xl border-2 overflow-hidden text-left transition-all
                      ${active ? 'border-blue-500 shadow-md shadow-blue-100' : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    {/* 線框式預覽 */}
                    <div className="h-24 bg-gray-50 p-2.5 flex flex-col gap-1.5 justify-center relative">
                      {t.key === 'classic' && (
                        <div className="grid grid-cols-2 gap-1">
                          {[0,1,2,3].map(i => (
                            <div key={i} className="h-6 rounded bg-white border border-gray-200 flex items-center px-1.5 gap-1">
                              <div className="w-2.5 h-2.5 rounded-sm bg-gray-200" />
                              <div className="flex-1 h-1.5 bg-gray-200 rounded-full" />
                            </div>
                          ))}
                        </div>
                      )}
                      {t.key === 'magazine' && (
                        <div className="flex gap-1.5 overflow-hidden">
                          {[preview.accent,'#a78bfa','#34d399'].map((c,i) => (
                            <div key={i} className="flex-shrink-0 w-14 h-16 rounded-lg flex flex-col justify-end p-1.5" style={{ background: `linear-gradient(135deg, ${c}88, ${c})` }}>
                              <div className="h-1.5 w-8 bg-white/70 rounded-full" />
                              <div className="h-1 w-5 bg-white/50 rounded-full mt-0.5" />
                            </div>
                          ))}
                        </div>
                      )}
                      {t.key === 'compact' && (
                        <div className="flex flex-col gap-1">
                          {[0,1,2,3].map(i => (
                            <div key={i} className="flex items-center gap-1.5 h-4">
                              <div className="w-4 h-4 rounded" style={{ background: `${preview.accent}22` }} />
                              <div className="flex-1 h-1.5 bg-gray-200 rounded-full" />
                              <div className="w-8 h-1.5 rounded-full" style={{ background: `${preview.accent}55` }} />
                            </div>
                          ))}
                        </div>
                      )}
                      {active && (
                        <div className="absolute top-2 right-2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="px-3 py-2">
                      <p className="text-xs font-semibold text-gray-800">{t.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5 leading-tight">{t.desc}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ─── LIFF 設定指引 ─── */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 space-y-2">
        <h2 className="font-semibold text-blue-800 flex items-center gap-2">
          <span>📋</span> LINE Developers Console 設定步驟
        </h2>
        <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
          <li>前往 <a href="https://developers.line.biz/console/" target="_blank" rel="noreferrer" className="underline hover:text-blue-900">LINE Developers Console</a>，選擇你的 Channel</li>
          <li>點選 <strong>LIFF</strong> 分頁 → <strong>Add</strong></li>
          <li>LIFF app name：任意填寫（例如 eSIM Store）</li>
          <li>Size：<strong>Full</strong></li>
          <li>Endpoint URL：填入下方的「<strong>LIFF Endpoint URL</strong>」</li>
          <li>Scope：勾選 <code className="bg-blue-100 px-1 rounded">profile</code>、<code className="bg-blue-100 px-1 rounded">openid</code></li>
          <li>建立後，將 LIFF ID 設定到 Vercel 環境變數 <code className="bg-blue-100 px-1 rounded">NEXT_PUBLIC_LIFF_ID</code></li>
        </ol>
      </div>

      {/* Key URLs */}
      <div className="bg-white rounded-2xl border shadow-sm divide-y">
        <div className="p-5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">LIFF Endpoint URL</span>
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">填入 LINE Developers</span>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <code className="flex-1 bg-gray-50 border rounded-lg px-3 py-2 text-sm font-mono text-gray-800 break-all">{endpointUrl}</code>
            <CopyBtn text={endpointUrl} id="endpoint" />
          </div>
          <p className="text-xs text-gray-400 mt-1.5">使用者點開 LIFF 連結時最先看到的頁面</p>
        </div>

        <div className="p-5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">LIFF 分享連結</span>
            <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">分享給使用者</span>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <code className="flex-1 bg-gray-50 border rounded-lg px-3 py-2 text-sm font-mono text-gray-800 break-all">{liffUrl}</code>
            {liffId && <CopyBtn text={liffUrl} id="liffurl" />}
          </div>
        </div>
      </div>

      {/* All Pages */}
      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b bg-gray-50">
          <h2 className="font-semibold text-sm">前台頁面一覽</h2>
        </div>
        <div className="divide-y">
          {LIFF_PAGES.map(p => {
            const url = `${baseUrl}${p.path}`
            const isEndpoint = p.path === '/products'
            return (
              <div key={p.path} className={`flex items-center px-5 py-3 gap-3 ${isEndpoint ? 'bg-green-50' : ''}`}>
                <span className="text-xl w-7 text-center">{p.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-800">{p.label}</span>
                    {isEndpoint && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">Endpoint</span>}
                  </div>
                  <code className="text-xs text-gray-400 font-mono">{url}</code>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <a href={url} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:text-blue-700 hover:underline">開啟 ↗</a>
                  <CopyBtn text={url} id={p.path} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Env reminder */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-5">
        <h2 className="font-semibold text-yellow-800 flex items-center gap-2 mb-3">⚙️ 相關環境變數</h2>
        <div className="space-y-2 text-sm">
          {[
            { key: 'NEXT_PUBLIC_LIFF_ID', desc: 'LINE Developers Console 建立 LIFF 後取得的 ID', required: true },
            { key: 'LINE_CHANNEL_ACCESS_TOKEN', desc: '在品牌設定頁填寫（已加密儲存）', required: true },
            { key: 'NEXT_PUBLIC_TAPPAY_ENV', desc: '"sandbox" 或 "production"', required: false },
          ].map(v => (
            <div key={v.key} className="flex items-start gap-2">
              <code className="bg-yellow-100 text-yellow-900 px-2 py-0.5 rounded text-xs font-mono flex-shrink-0">{v.key}</code>
              <span className="text-yellow-800 text-xs">{v.desc}</span>
              {v.required && <span className="text-xs text-red-500 flex-shrink-0">必填</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
