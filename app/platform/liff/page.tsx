'use client'

import { useState, useEffect } from 'react'
import {
  HOME_TEMPLATE_META, PRODUCTS_TEMPLATE_META,
} from '@/components/liff/templates/registry'
import type { HomeTemplate, ProductsTemplate } from '@/components/liff/TenantContext'

// Template preview colours per key
const HOME_PREVIEW: Record<string, { bg: string; label: string }> = {
  landmark: { bg: 'linear-gradient(160deg,#FAF9F6,#fff)', label: '經典首頁' },
  gradient: { bg: 'linear-gradient(160deg,#0a0a0f,#1e1b4b)', label: '暗黑探索家' },
  minimal:  { bg: 'linear-gradient(160deg,#ffffff,#f7f8fa)', label: '清新微風' },
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

  const liffUrl = liffId ? `https://liff.line.me/${liffId}` : '（請先設定 NEXT_PUBLIC_LIFF_ID）'

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">LIFF 前台設定</h1>

        {/* ─── LIFF 分享連結 ─── */}
        <div className="mt-4 bg-white rounded-2xl border shadow-sm p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">LIFF 分享連結</span>
            <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">分享給使用者</span>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-gray-50 border rounded-lg px-3 py-2 text-sm font-mono text-gray-800 break-all">{liffUrl}</code>
            {liffId && <CopyBtn text={liffUrl} id="liffurl" />}
          </div>
        </div>
      </div>

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
                        <div className="w-full px-2 flex flex-col gap-1.5">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <div className="w-5 h-5 rounded-md bg-amber-100 flex items-center justify-center text-xs">🐝</div>
                            <div className="h-2 w-12 bg-gray-200 rounded-full"/>
                          </div>
                          <div className="h-6 bg-white rounded-lg border border-gray-100 flex items-center px-2 gap-1">
                            <div className="w-2 h-2 rounded-full bg-gray-200"/>
                            <div className="flex-1 h-1.5 bg-gray-100 rounded-full"/>
                          </div>
                          <div className="grid grid-cols-4 gap-1">
                            {[0,1,2,3].map(i=><div key={i} className="h-7 rounded-lg bg-orange-50"/>)}
                          </div>
                        </div>
                      )}
                      {t.key === 'gradient' && (
                        <div className="w-full px-2 flex flex-col gap-1.5">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <div className="w-5 h-5 rounded-md bg-white/10 border border-white/20"/>
                            <div className="h-1.5 w-10 bg-white/30 rounded-full"/>
                          </div>
                          <div className="h-6 bg-white/10 rounded-lg border border-white/10 flex items-center px-2 gap-1">
                            <div className="w-2 h-2 rounded-full bg-white/20"/>
                            <div className="flex-1 h-1.5 bg-white/15 rounded-full"/>
                          </div>
                          <div className="flex gap-1 overflow-hidden">
                            {['#312e81','#1e3a5f','#166534'].map((c,i)=>(
                              <div key={i} className="flex-1 h-10 rounded-lg" style={{background:`linear-gradient(145deg,${c},${c}88)`}}/>
                            ))}
                          </div>
                        </div>
                      )}
                      {t.key === 'minimal' && (
                        <div className="w-full px-2 flex flex-col gap-1.5">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <div className="w-5 h-5 rounded-full bg-gray-100 border border-gray-200"/>
                            <div className="h-1.5 w-10 bg-gray-200 rounded-full"/>
                          </div>
                          <div className="h-6 bg-gray-100 rounded-xl"/>
                          <div className="flex flex-col gap-1">
                            {[0,1,2].map(i=>(
                              <div key={i} className="h-5 bg-gray-50 rounded-lg border border-gray-100 flex items-center px-2 gap-1.5">
                                <div className="w-3 h-3 rounded bg-gray-200"/>
                                <div className="flex-1 h-1.5 bg-gray-200 rounded-full"/>
                              </div>
                            ))}
                          </div>
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

    </div>
  )
}
