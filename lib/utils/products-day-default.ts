// 商品頁進入時的「想用幾天」預設值挑選邏輯。
// 規則：永遠以 5 天為預設；若該國家沒有 5 天方案，fallback 到 availableDays 中距離 5 最近的值。
// 抽成共用 helper 是為了讓 (liff) 與 liff/[slug] 兩條路徑共用同一份邏輯（避免再次只改一邊）。

export const PRODUCTS_DEFAULT_DAYS = 5

export function pickInitialDay(availableDays: readonly number[]): number | null {
  if (availableDays.length === 0) return null
  if (availableDays.includes(PRODUCTS_DEFAULT_DAYS)) return PRODUCTS_DEFAULT_DAYS
  return [...availableDays].sort(
    (a, b) => Math.abs(a - PRODUCTS_DEFAULT_DAYS) - Math.abs(b - PRODUCTS_DEFAULT_DAYS),
  )[0]
}
