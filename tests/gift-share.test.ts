import { describe, it, expect } from 'vitest'
import type { Liff } from '@line/liff'
import { isPendingGift, canDetectShareCancel } from '@/lib/utils/gift-share'

const future = new Date(Date.now() + 86_400_000).toISOString()
const past   = new Date(Date.now() - 86_400_000).toISOString()

const gift = (over: Partial<{ claimedAt: string | null; cancelledAt: string | null; expiresAt: string }> = {}) => ({
  claimedAt: null, cancelledAt: null, expiresAt: future, ...over,
})

// 只需要 isInClient / getLineVersion 兩支
function liffStub(isInClient: boolean, lineVersion: string | null): Liff {
  return { isInClient: () => isInClient, getLineVersion: () => lineVersion } as unknown as Liff
}

describe('isPendingGift', () => {
  it('沒有 gift → 不是等待領取', () => {
    expect(isPendingGift(null)).toBe(false)
    expect(isPendingGift(undefined)).toBe(false)
  })

  it('已分享、未領取、未取消、未過期 → 等待領取', () => {
    expect(isPendingGift(gift())).toBe(true)
  })

  it('已被領取 → 不是等待領取（擁有權已轉移）', () => {
    expect(isPendingGift(gift({ claimedAt: past }))).toBe(false)
  })

  it('已取消 → 不是等待領取', () => {
    expect(isPendingGift(gift({ cancelledAt: past }))).toBe(false)
  })

  it('已過期 → 不是等待領取（cron 尚未把 cancelledAt 補上也一樣）', () => {
    expect(isPendingGift(gift({ expiresAt: past }))).toBe(false)
  })
})

describe('canDetectShareCancel', () => {
  it('外部瀏覽器一律會等分享結果 → 可判斷', () => {
    expect(canDetectShareCancel(liffStub(false, null))).toBe(true)
  })

  it('LINE >= 10.11.0 → 可判斷', () => {
    expect(canDetectShareCancel(liffStub(true, '10.11.0'))).toBe(true)
    expect(canDetectShareCancel(liffStub(true, '13.5.0'))).toBe(true)
  })

  // 這些版本成功也回 undefined，若當成「取消」會把對方真的收到的連結收回
  it('LINE < 10.11.0 → 不可判斷，不得自動收回 gift', () => {
    expect(canDetectShareCancel(liffStub(true, '10.10.5'))).toBe(false)
    expect(canDetectShareCancel(liffStub(true, '9.20.0'))).toBe(false)
  })

  it('版本讀不到／格式怪 → 保守當作不可判斷', () => {
    expect(canDetectShareCancel(liffStub(true, null))).toBe(false)
    expect(canDetectShareCancel(liffStub(true, 'unknown'))).toBe(false)
  })
})
