'use client'

import { useState, useEffect } from 'react'

const LIFF_PAGES = [
  { path: '/',              label: '首頁',     icon: '🏠', desc: '主入口頁面' },
  { path: '/products',      label: '商品列表',  icon: '📱', desc: 'LIFF Endpoint 填這個' },
  { path: '/orders',        label: '我的訂單',  icon: '🧾', desc: '訂單查詢' },
  { path: '/profile',       label: '個人資料',  icon: '👤', desc: '會員資料設定' },
  { path: '/coupons',       label: '優惠券',    icon: '🎫', desc: '優惠券列表' },
  { path: '/group',         label: '加入社群',  icon: '🏘️', desc: '社群加入頁' },
  { path: '/support',       label: '客服',      icon: '💬', desc: '客服聯繫頁' },
]

export default function LiffSettingsPage() {
  const [baseUrl, setBaseUrl] = useState('')
  const [liffId, setLiffId] = useState('')
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    // Derive the site base URL from current hostname (platform admin = same origin)
    setBaseUrl(window.location.origin)
    // Read LIFF ID from meta or just show placeholder
    setLiffId(process.env.NEXT_PUBLIC_LIFF_ID ?? '')
  }, [])

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 1500)
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
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">LIFF 前台設定</h1>

      {/* Setup Guide */}
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
        {/* Endpoint URL */}
        <div className="p-5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">LIFF Endpoint URL</span>
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">填入 LINE Developers</span>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <code className="flex-1 bg-gray-50 border rounded-lg px-3 py-2 text-sm font-mono text-gray-800 break-all">
              {endpointUrl}
            </code>
            <CopyBtn text={endpointUrl} id="endpoint" />
          </div>
          <p className="text-xs text-gray-400 mt-1.5">這是使用者點開 LIFF 連結時最先看到的頁面（商品列表）</p>
        </div>

        {/* LIFF URL */}
        <div className="p-5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">LIFF 分享連結</span>
            <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">分享給使用者</span>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <code className="flex-1 bg-gray-50 border rounded-lg px-3 py-2 text-sm font-mono text-gray-800 break-all">
              {liffUrl}
            </code>
            {liffId && <CopyBtn text={liffUrl} id="liffurl" />}
          </div>
          <p className="text-xs text-gray-400 mt-1.5">貼到 LINE 訊息或 Flex Message 讓用戶點擊開啟</p>
        </div>
      </div>

      {/* All Pages */}
      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b bg-gray-50">
          <h2 className="font-semibold text-sm">前台頁面一覽</h2>
          <p className="text-xs text-gray-400 mt-0.5">所有 LIFF 前台頁面的完整網址</p>
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
                    {isEndpoint && (
                      <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">Endpoint</span>
                    )}
                  </div>
                  <code className="text-xs text-gray-400 font-mono">{url}</code>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-blue-500 hover:text-blue-700 hover:underline"
                  >
                    開啟 ↗
                  </a>
                  <CopyBtn text={url} id={p.path} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Env Vars reminder */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-5">
        <h2 className="font-semibold text-yellow-800 flex items-center gap-2 mb-3">
          <span>⚙️</span> 相關環境變數
        </h2>
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
