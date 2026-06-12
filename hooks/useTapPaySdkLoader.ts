'use client'

import { useEffect, useState } from 'react'

// TapPay SDK 載入策略：
// - LINE webview 內 next/script 的 onLoad/onReady 常被吃掉，故改 imperative 注入
// - 用 dataset 標記避免同一頁面重複 append
// - 仍保留輪詢，作為 onload 漏觸發的備援
//
// 回傳 `sdkLoaded`：window.TPDirect 已就緒。
//
// 抽成 hook 是為了讓邏輯可在 jsdom 下被測試（檢查 head 是否多了 script、
// polling 偵測到 TPDirect 後狀態翻成 true）。

export const TAPPAY_SDK_SRC = 'https://js.tappaysdk.com/tappay.js'

export interface UseTapPaySdkLoaderOptions {
  /** poll 頻率（ms）。預設 300。測試時可調小加速。 */
  pollIntervalMs?: number
}

export function useTapPaySdkLoader(options: UseTapPaySdkLoaderOptions = {}): boolean {
  const { pollIntervalMs = 300 } = options
  const [sdkLoaded, setSdkLoaded] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    // 已有就直接 ready
    if ((window as unknown as { TPDirect?: unknown }).TPDirect) {
      setSdkLoaded(true)
      return
    }

    let script = document.querySelector<HTMLScriptElement>('script[data-tappay-sdk="1"]')
    if (!script) {
      script = document.createElement('script')
      script.src = TAPPAY_SDK_SRC
      script.async = true
      script.dataset.tappaySdk = '1'
      script.onload = () => {
        if ((window as unknown as { TPDirect?: unknown }).TPDirect) setSdkLoaded(true)
      }
      document.head.appendChild(script)
    }

    const t = setInterval(() => {
      if ((window as unknown as { TPDirect?: unknown }).TPDirect) {
        setSdkLoaded(true)
        clearInterval(t)
      }
    }, pollIntervalMs)
    return () => clearInterval(t)
  }, [pollIntervalMs])

  return sdkLoaded
}
