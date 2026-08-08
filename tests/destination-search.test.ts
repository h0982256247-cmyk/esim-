import { describe, it, expect } from 'vitest'
import { destinationMatches } from '@/lib/utils/destination-search'

// 目的地搜尋（含「適用國家」）：核心情境是「打香港，香港與中港澳都要出現」。
const HK       = { countryNameZh: '香港',   countryNameEn: 'Hong Kong',        countryCode: 'HK',     coverage: '香港' }
const CN_HK_MO = { countryNameZh: '中港澳', countryNameEn: 'China HK Macau',   countryCode: 'CNHKMO', coverage: '中國、香港、澳門' }
const JP       = { countryNameZh: '日本',   countryNameEn: 'Japan',            countryCode: 'JP',     coverage: null }

describe('destinationMatches — 目的地搜尋（含適用國家）', () => {
  it('空字串 → 全部命中', () => {
    expect(destinationMatches('', JP)).toBe(true)
    expect(destinationMatches('   ', CN_HK_MO)).toBe(true)
  })
  it('中文名命中', () => {
    expect(destinationMatches('日本', JP)).toBe(true)
  })
  it('英文名命中（不分大小寫）', () => {
    expect(destinationMatches('japan', JP)).toBe(true)
    expect(destinationMatches('HONG', HK)).toBe(true)
  })
  it('國碼命中', () => {
    expect(destinationMatches('jp', JP)).toBe(true)
  })
  it('打「香港」→ 香港本身命中', () => {
    expect(destinationMatches('香港', HK)).toBe(true)
  })
  it('打「香港」→ coverage 含香港的中港澳也命中（核心需求）', () => {
    expect(destinationMatches('香港', CN_HK_MO)).toBe(true)
    expect(destinationMatches('澳門', CN_HK_MO)).toBe(true)
  })
  it('不相關字串不命中', () => {
    expect(destinationMatches('泰國', CN_HK_MO)).toBe(false)
    expect(destinationMatches('香港', JP)).toBe(false)
  })
})
