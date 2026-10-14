// 轉贈（gift）分享流程的前端共用判斷。訂單列表卡與訂單詳情頁兩條路由都要用同
// 一套規則，否則兩邊會對「這張卡還在等待領取嗎」給出不一致的答案。

import type { Liff } from '@line/liff'

/** 判斷 pending 只需要這三個欄位；列表與詳情頁各自的 gift 型別都相容 */
type GiftLike = {
  claimedAt: string | null
  cancelledAt: string | null
  expiresAt: string
}

/** 已分享、未領取、未取消、未過期 → 卡片停在「等待領取」 */
export function isPendingGift(gift: GiftLike | null | undefined): boolean {
  if (!gift) return false
  if (gift.claimedAt || gift.cancelledAt) return false
  return new Date(gift.expiresAt) > new Date()
}

// shareTargetPicker 的回傳值能不能分辨「已送出」與「使用者取消」。
//
// LIFF 只有在 waitForSubwindowResult 生效時才會回 { status: 'success' }（取消回
// undefined）；SDK 僅在「LINE app 內且版本 < 10.11.0」把它關掉，那種情況送出成功
// 也是回 undefined。分不出來時就不能拿 undefined 當「取消」去收回已建立的 gift，
// 否則會把對方真的收到的連結弄失效。判斷不了一律回 false（保守不收回）。
export function canDetectShareCancel(liff: Liff): boolean {
  if (!liff.isInClient()) return true   // 外部瀏覽器一律會等結果
  const version = liff.getLineVersion()
  if (!version) return false
  const [major, minor] = version.split('.').map(n => parseInt(n, 10))
  if (!Number.isFinite(major) || !Number.isFinite(minor)) return false
  return major > 10 || (major === 10 && minor >= 11)
}
