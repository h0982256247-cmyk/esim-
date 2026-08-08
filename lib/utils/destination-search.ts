// 目的地搜尋單一來源（商城 + 主頁共用）：判斷輸入字串是否命中某目的地。
// 命中條件：中文名 / 英文名 / 國碼 / 該目的地方案的「適用國家」(coverage) 任一 token。
// 例：輸入「香港」→ 香港本身，以及 coverage 含香港的「中港澳」都會命中。
// 註：coverage 的切分符與 getCoverageList（CoverageCountries）保持一致。

export type SearchableDestination = {
  countryNameZh: string
  countryNameEn: string
  countryCode: string
  coverage?: string | null
}

export function destinationMatches(query: string, c: SearchableDestination): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  if (c.countryNameZh.toLowerCase().includes(q)) return true
  if (c.countryNameEn.toLowerCase().includes(q)) return true
  if (c.countryCode.toLowerCase().includes(q)) return true
  if (!c.coverage) return false
  return c.coverage
    .split(/[、,，;；/\n\s]+/)
    .some(t => { const s = t.trim(); return s.length > 0 && s.toLowerCase().includes(q) })
}
