import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { deriveEsimStatus, daysLeftOf, groupOf } from '@/lib/esimStatus'

// deriveEsimStatus 是列表＋詳情共用的「使用者視角狀態」單一來源，用固定時間測
// 到期邊界（daysLeftOf 用 Date.now()）。
const NOW = new Date('2026-06-13T00:00:00Z').getTime()
const DAY = 86_400_000
const iso = (ms: number) => new Date(ms).toISOString()

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW) })
afterEach(() => { vi.useRealTimers() })

describe('deriveEsimStatus', () => {
  it('終態：FAILED / REFUNDED / CANCELLED', () => {
    expect(deriveEsimStatus({ status: 'FAILED' })).toMatchObject({ phase: 'failed', tone: 'error' })
    expect(deriveEsimStatus({ status: 'REFUNDED' }).phase).toBe('refunded')
    expect(deriveEsimStatus({ status: 'CANCELLED' }).phase).toBe('cancelled')
  })

  it('已激活且距到期 >3 天 → inUse，daysLeft 正確、tone active', () => {
    const v = deriveEsimStatus({ status: 'COMPLETED', activatedAt: 'x', activationEnd: iso(NOW + 10 * DAY) })
    expect(v).toMatchObject({ phase: 'inUse', tone: 'active', daysLeft: 10 })
  })

  it('已激活且 ≤3 天 → expiringSoon / warn', () => {
    const v = deriveEsimStatus({ status: 'COMPLETED', activatedAt: 'x', activationEnd: iso(NOW + 2 * DAY) })
    expect(v).toMatchObject({ phase: 'expiringSoon', tone: 'warn', daysLeft: 2 })
  })

  it('已激活但已過期 → ended', () => {
    const v = deriveEsimStatus({ status: 'COMPLETED', activatedAt: 'x', activationEnd: iso(NOW - 2 * DAY) })
    expect(v.phase).toBe('ended')
  })

  it('已激活、無到期日 → inUse，daysLeft null', () => {
    const v = deriveEsimStatus({ status: 'COMPLETED', activatedAt: 'x' })
    expect(v.phase).toBe('inUse')
    expect(v.daysLeft).toBeNull()
  })

  it('QR 已就緒、未激活 → installable，actionNeeded', () => {
    const v = deriveEsimStatus({ status: 'COMPLETED', esimRcode: 'r', esimQrcode: 'data:image/png;base64,xxx' })
    expect(v).toMatchObject({ phase: 'installable', actionNeeded: true })
  })

  it('已兌換、QR 未到 → generatingQr', () => {
    const v = deriveEsimStatus({ status: 'COMPLETED', esimRcode: 'r', redeemedAt: 'x' })
    expect(v.phase).toBe('generatingQr')
  })

  it('有 rcode、COMPLETED、未兌換 → readyToInstall，actionNeeded', () => {
    const v = deriveEsimStatus({ status: 'COMPLETED', esimRcode: 'r' })
    expect(v).toMatchObject({ phase: 'readyToInstall', actionNeeded: true })
  })

  it('PROCESSING → awaitingPayment；PAID（無 esim 欄位）→ preparing', () => {
    expect(deriveEsimStatus({ status: 'PROCESSING' }).phase).toBe('awaitingPayment')
    expect(deriveEsimStatus({ status: 'PAID' }).phase).toBe('preparing')
  })
})

describe('daysLeftOf — 台北午夜對齊', () => {
  // 規則：剩餘天數只在台北時間 00:00 換日，不論當初幾點激活。
  const at = (tpe: string) => vi.setSystemTime(new Date(tpe).getTime())
  const END = '2026-06-18T06:00:00+08:00' // WM useEDate：06:00 激活 + 5 天

  it('同一個日曆日內天數不變，跨台北午夜才減 1', () => {
    at('2026-06-13T06:05:00+08:00'); expect(daysLeftOf(END)).toBe(5)
    at('2026-06-13T23:59:59+08:00'); expect(daysLeftOf(END)).toBe(5)
    at('2026-06-14T00:00:00+08:00'); expect(daysLeftOf(END)).toBe(4)
    at('2026-06-14T06:00:00+08:00'); expect(daysLeftOf(END)).toBe(4) // 不在激活鐘點掉
  })

  it('幾點激活不影響天數（同一天到期，06:00 與 23:00 一樣）', () => {
    at('2026-06-13T12:00:00+08:00')
    expect(daysLeftOf('2026-06-18T06:00:00+08:00')).toBe(5)
    expect(daysLeftOf('2026-06-18T23:00:00+08:00')).toBe(5)
  })

  it('日界以台北午夜為準，不是 UTC 午夜', () => {
    at('2026-06-13T08:00:00+08:00')
    expect(daysLeftOf('2026-06-17T16:00:00Z')).toBe(5)  // = 6/18 00:00 台北
    expect(daysLeftOf('2026-06-17T15:59:59Z')).toBe(4)  // = 6/17 23:59 台北
  })

  it('到期日當天 = 0「今天到期」、隔天 = -1「已結束」（不再回 -0）', () => {
    const o = { status: 'COMPLETED', activatedAt: 'x', activationEnd: END }

    at('2026-06-18T07:00:00+08:00') // 已過實際到期鐘點，但還在同一個日曆日
    expect(daysLeftOf(END)).toBe(0)
    expect(deriveEsimStatus(o)).toMatchObject({ phase: 'expiringSoon', hint: '今天到期' })

    at('2026-06-19T00:00:00+08:00') // 舊版 Math.ceil(-0.75) = -0，-0 < 0 為 false → 多掛一天
    expect(Object.is(daysLeftOf(END), -0)).toBe(false)
    expect(daysLeftOf(END)).toBe(-1)
    expect(deriveEsimStatus(o).phase).toBe('ended')
  })
})

describe('groupOf — 分頁分組', () => {
  it('inUse/expiringSoon → active', () => {
    expect(groupOf('inUse')).toBe('active')
    expect(groupOf('expiringSoon')).toBe('active')
  })
  it('readyToInstall/installable/generatingQr → install', () => {
    expect(groupOf('readyToInstall')).toBe('install')
    expect(groupOf('installable')).toBe('install')
    expect(groupOf('generatingQr')).toBe('install')
  })
  it('awaitingPayment/preparing → processing', () => {
    expect(groupOf('awaitingPayment')).toBe('processing')
    expect(groupOf('preparing')).toBe('processing')
  })
  it('ended/cancelled/failed/refunded → history', () => {
    for (const p of ['ended', 'cancelled', 'failed', 'refunded'] as const) {
      expect(groupOf(p)).toBe('history')
    }
  })
})
