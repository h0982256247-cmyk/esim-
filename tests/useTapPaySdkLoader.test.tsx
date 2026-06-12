import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useTapPaySdkLoader, TAPPAY_SDK_SRC } from '@/hooks/useTapPaySdkLoader'

function clearSdk() {
  delete (window as unknown as { TPDirect?: unknown }).TPDirect
  document.querySelectorAll('script[data-tappay-sdk]').forEach(s => s.remove())
}

describe('useTapPaySdkLoader', () => {
  beforeEach(() => { clearSdk() })
  afterEach(() => { clearSdk() })

  it('appends the SDK script to document.head when not present', () => {
    renderHook(() => useTapPaySdkLoader({ pollIntervalMs: 10 }))
    const script = document.querySelector<HTMLScriptElement>('script[data-tappay-sdk="1"]')
    expect(script).not.toBeNull()
    expect(script?.src).toBe(TAPPAY_SDK_SRC)
    expect(script?.async).toBe(true)
  })

  it('does not double-inject when remounted', () => {
    const { unmount } = renderHook(() => useTapPaySdkLoader({ pollIntervalMs: 10 }))
    unmount()
    renderHook(() => useTapPaySdkLoader({ pollIntervalMs: 10 }))
    expect(document.querySelectorAll('script[data-tappay-sdk="1"]')).toHaveLength(1)
  })

  it('returns true immediately when window.TPDirect is already defined', () => {
    ;(window as unknown as { TPDirect: object }).TPDirect = {}
    const { result } = renderHook(() => useTapPaySdkLoader({ pollIntervalMs: 10 }))
    expect(result.current).toBe(true)
    // 已 ready 就不該再注入 script
    expect(document.querySelector('script[data-tappay-sdk="1"]')).toBeNull()
  })

  it('flips to true via polling once window.TPDirect appears (simulates onload-miss in LINE webview)', async () => {
    const { result } = renderHook(() => useTapPaySdkLoader({ pollIntervalMs: 10 }))
    expect(result.current).toBe(false)

    // 模擬 LINE webview 環境：腳本載完但 onLoad 沒觸發 → 輪詢需要自己抓到
    ;(window as unknown as { TPDirect: object }).TPDirect = {}
    await waitFor(() => expect(result.current).toBe(true), { timeout: 500, interval: 10 })
  })
})
