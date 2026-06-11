// Parse data capacity from CSV product names, plan codes, or SKU strings.
// Shared by CSV import and the admin "recompute meta" tool so they classify
// rows consistently. Returns a display string (e.g. "吃到飽" / "1GB/天" /
// "500MB") or null when nothing recognisable is found.

// 「token 前後是否為國家／詞邊界」 - 寬鬆版：允許前面是數字（10MAX-1D 也算）
// 但仍然排除前後是英文字母的情況（避免 MAXIMUM 被當吃到飽）。
const TI_RE  = /(?<![A-Za-z])TI(?![A-Za-z])/i
const HSD_RE = /(?<![A-Za-z])HSD(?![A-Za-z])/i
const MAX_RE = /(?<![A-Za-z])MAX(?![A-Za-z])/i

// 數字流量：500MB / 1GB / 1GB/天 / 1.5GB/day
const SIZE_RE = /(\d+(?:\.\d+)?)\s*(MB|GB|TB)(\/天|\/日|\/day)?/i

export function parseCapacityFromName(name: string): string | null {
  if (!name) return null

  // 中文吃到飽 token，先檢查最具體的（鈦金 / 高速）再 fallback 到一般吃到飽
  if (/鈦金吃到飽/.test(name))                              return '鈦金吃到飽'
  if (/高速吃到飽/.test(name))                              return '高速吃到飽'
  if (/(無限量|不限流量|無限流量|吃到飽)/.test(name))       return '吃到飽'

  // 英文 token：TI / HSD / MAX
  if (TI_RE.test(name))  return '鈦金吃到飽'
  if (HSD_RE.test(name)) return '高速吃到飽'
  if (MAX_RE.test(name)) return '吃到飽'

  const m = name.match(SIZE_RE)
  if (!m) return null
  return m[3] ? `${m[1]}${m[2].toUpperCase()}${m[3]}` : `${m[1]}${m[2].toUpperCase()}`
}
