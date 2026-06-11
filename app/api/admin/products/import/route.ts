import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { requirePlatformAuth } from '@/lib/auth/platform'
import { batchCreateProducts, type CsvProductRow } from '@/lib/services/product'
import { fetchSupplierProductMap } from '@/lib/services/esim'

// Vercel 預設 serverless function timeout 為 10 秒，CSV 匯入需呼叫供應商 API +
// 走 PgBouncer connection_limit=1 的逐筆寫入，列數一多 10 秒不夠。拉到 60 秒
// （Hobby 上限）。
export const maxDuration = 60

// ── 欄位別名對應表（中文欄位名 → 內部英文名）──────────────────────
const HEADER_ALIAS: Record<string, string> = {
  // 中文欄位名（使用者試算表）
  '供應商方案id':   'supplierSkuId',
  '供應商方案ID':   'supplierSkuId',
  'plan_code':      'planCode',
  '商品名稱':       'productName',
  '適用地區':       'countryNameZh',
  '是否為原生卡':   'isNativeSim',
  '網絡類型':       'networkType',
  '成本價nt':       'costPrice',
  '成本價(nt)':     'costPrice',
  '成本價':         'costPrice',
  '售價nt':         'sellPrice',
  '售價(nt)':       'sellPrice',
  '售價':           'sellPrice',
  '利潤':           '_skip',
  // 英文欄位名（template）
  'supplierskuid':  'supplierSkuId',
  'countrycode':    'countryCode',
  'countrynamezh':  'countryNameZh',
  'countrynateen':  'countryNameEn',
  'countryflag':    'countryFlag',
  'displaydays':    'displayDays',
  'datacapacity':   'dataCapacity',
  'description':    'description',
  'sellprice':      'sellPrice',
  'costprice':      'costPrice',
  'sortorder':      'sortOrder',
  'networktype':    'networkType',
  'isnativesim':    'isNativeSim',
  'plancode':       'planCode',
  'productname':    'productName',
}

// 必填欄位（至少要有其中一組）
const REQUIRED = ['supplierSkuId', 'sellPrice', 'costPrice']

// 從商品名稱自動解析天數，例如「日本Softbank, 3天, 1GB/天」→ 3
function parseDaysFromName(name: string): number | null {
  const m = name.match(/(\d+)\s*天/)
  return m ? parseInt(m[1]) : null
}

// 商品名稱拆成 [國家, 天數段, 流量段]
// 範例：「美國, 10天, 3GB/天」→ { country: "美國", days: 10, capacity: "3GB/天" }
//       「菲律賓, 1天, 吃到飽」→ { country: "菲律賓", days: 1, capacity: "吃到飽" }
function parseProductNameSegments(name: string): { country?: string; days?: number; capacity?: string } {
  if (!name) return {}
  const parts = name.split(/[,，、]/).map(s => s.trim()).filter(Boolean)
  if (parts.length === 0) return {}

  const country = parts[0] || undefined

  // 天數段：找 "X天" 或 "X日"
  let days: number | undefined
  for (const seg of parts.slice(1)) {
    const m = seg.match(/(\d+)\s*[天日]/)
    if (m) { days = parseInt(m[1]); break }
  }

  // 流量段：吃到飽 token + GB/MB 數字
  let capacity: string | undefined
  for (const seg of parts.slice(1)) {
    const fromSeg = parseCapacityFromName(seg)
    if (fromSeg) { capacity = fromSeg; break }
  }

  return { country, days, capacity }
}

// 常見中文國家／地區名稱對應 ISO 3166-1 alpha-2 代碼
// 多國方案用自訂 3 字母代碼（ANZ / SEA / HKM 等）
const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  // 亞洲
  '日本': 'JP', '韓國': 'KR', '南韓': 'KR', '北韓': 'KP',
  '台灣': 'TW', '中國': 'CN', '中國大陸': 'CN',
  '香港': 'HK', '澳門': 'MO', '澳门': 'MO',
  '新加坡': 'SG', '馬來西亞': 'MY', '马来西亚': 'MY',
  '泰國': 'TH', '越南': 'VN', '印尼': 'ID', '菲律賓': 'PH', '菲律宾': 'PH',
  '柬埔寨': 'KH', '寮國': 'LA', '寮国': 'LA', '緬甸': 'MM', '缅甸': 'MM',
  '印度': 'IN', '巴基斯坦': 'PK', '孟加拉': 'BD', '斯里蘭卡': 'LK', '斯里兰卡': 'LK',
  '尼泊爾': 'NP', '尼泊尔': 'NP', '不丹': 'BT', '馬爾地夫': 'MV',
  '蒙古': 'MN', '哈薩克': 'KZ', '哈萨克': 'KZ', '烏茲別克': 'UZ', '吉爾吉斯': 'KG',
  '土耳其': 'TR', '以色列': 'IL', '阿聯': 'AE', '阿联酋': 'AE', '沙烏地阿拉伯': 'SA',
  '伊朗': 'IR', '伊拉克': 'IQ', '約旦': 'JO', '黎巴嫩': 'LB', '卡達': 'QA', '卡塔尔': 'QA',
  // 歐洲
  '英國': 'GB', '英国': 'GB', '法國': 'FR', '德國': 'DE', '德国': 'DE',
  '義大利': 'IT', '意大利': 'IT', '西班牙': 'ES', '葡萄牙': 'PT',
  '荷蘭': 'NL', '荷兰': 'NL', '比利時': 'BE', '盧森堡': 'LU', '瑞士': 'CH', '奧地利': 'AT',
  '瑞典': 'SE', '挪威': 'NO', '丹麥': 'DK', '芬蘭': 'FI', '冰島': 'IS',
  '愛爾蘭': 'IE', '波蘭': 'PL', '捷克': 'CZ', '匈牙利': 'HU', '希臘': 'GR',
  '俄羅斯': 'RU', '俄罗斯': 'RU', '烏克蘭': 'UA',
  '羅馬尼亞': 'RO', '保加利亞': 'BG', '克羅埃西亞': 'HR', '塞爾維亞': 'RS',
  // 美洲
  '美國': 'US', '美国': 'US', '加拿大': 'CA', '墨西哥': 'MX',
  '巴西': 'BR', '阿根廷': 'AR', '智利': 'CL', '哥倫比亞': 'CO', '秘魯': 'PE',
  // 非洲
  '南非': 'ZA', '埃及': 'EG', '摩洛哥': 'MA', '肯亞': 'KE', '奈及利亞': 'NG',
  // 大洋洲
  '澳洲': 'AU', '澳大利亞': 'AU', '紐西蘭': 'NZ', '新西兰': 'NZ',
  '斐濟': 'FJ', '關島': 'GU',
  // 多國／區域方案（自訂 code）
  '紐澳': 'ANZ', '澳紐': 'ANZ',
  '東南亞': 'SEA', '东南亚': 'SEA',
  '港澳': 'HKM',
  '兩岸三地': 'CNT', '中港台': 'CNT', '中港澳': 'CNT',
  '歐洲': 'EU', '欧洲': 'EU',
  '中東': 'MEA', '中东': 'MEA',
  '全球': 'WW', '世界': 'WW',
  // 商家常用的雙國組合（自訂 code）
  '新馬': 'NMY', '马新': 'NMY', '馬新': 'NMY',
  '日韓': 'JPK', '韓日': 'JPK', '韩日': 'JPK',
  '中港': 'CNHK',
  '中台': 'CNTW',
  '美加': 'USCA', '加美': 'USCA',
  '台日': 'TWJP', '日台': 'TWJP',
  '台韓': 'TWKR', '韓台': 'TWKR',
}

function countryNameToCode(name: string): string | null {
  if (!name) return null
  const trimmed = name.trim()
  return COUNTRY_NAME_TO_CODE[trimmed] ?? null
}

// COUNTRY_NAME_TO_CODE 的 key 預先按長度倒序，避免「東南亞」被「亞」這種短 key
// 先匹配。模組載入時計算一次。
const COUNTRY_NAME_KEYS = Object.keys(COUNTRY_NAME_TO_CODE).sort((a, b) => b.length - a.length)

// 在任意字串中找出最先出現的國家／區域名稱。例如：
//   「日本Softbank」 → { code: 'JP', zh: '日本' }
//   「東南亞7國方案」 → { code: 'SEA', zh: '東南亞' }
//   「中港澳吃到飽」  → { code: 'CNT', zh: '中港澳' }
// CSV 商品名稱第 1 段直接用這個比對，比靠 SKU 推斷準確。
function matchCountryInText(text: string): { code: string; zh: string } | null {
  if (!text) return null
  for (const key of COUNTRY_NAME_KEYS) {
    if (text.includes(key)) return { code: COUNTRY_NAME_TO_CODE[key], zh: key }
  }
  return null
}

// 從商品名稱／SKU 自動解析流量
// 1. 吃到飽 token：MAX / TI / HSD（先檢查，避免被一般數字 regex 誤匹配）
//    例如 WM-e-AN-MAX-1D → 吃到飽
//         WM-e-AN-TI-1D  → 鈦金吃到飽
//         WM-e-AN-HSD-1D → 高速吃到飽
// 2. 數字流量：500MB / 1GB / 1GB/天
function parseCapacityFromName(name: string): string | null {
  // SKU 結構通常用 `-` 分隔，token 用 `-XX-` 或字串邊界包夾
  if (/(?:^|[-_\s])TI(?:[-_\s]|$)/i.test(name))  return '鈦金吃到飽'
  if (/(?:^|[-_\s])HSD(?:[-_\s]|$)/i.test(name)) return '高速吃到飽'
  if (/(?:^|[-_\s])MAX(?:[-_\s]|$)/i.test(name)) return '吃到飽'

  const m = name.match(/(\d+(?:\.\d+)?)\s*(MB|GB)(\/天|\/day)?/i)
  if (!m) return null
  return m[3] ? `${m[1]}${m[2].toUpperCase()}${m[3]}` : `${m[1]}${m[2].toUpperCase()}`
}

// ISO 3166-1 alpha-2 → 國旗 emoji（Regional Indicator）
function countryCodeToFlag(code: string): string {
  if (!code || code.length !== 2) return ''
  const [a, b] = code.toUpperCase().split('')
  const toRI = (c: string) => String.fromCodePoint(c.codePointAt(0)! + 127397)
  return toRI(a) + toRI(b)
}

// 正規化 header（去空白、小寫、去括號）
function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[\s()（）]/g, '')
}

function parseCsv(text: string): { rows: CsvProductRow[]; errors: string[] } {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return { rows: [], errors: ['CSV 檔案缺少資料列'] }

  // Parse headers with alias mapping
  const rawHeaders = lines[0].split(',').map(h => h.trim().replace(/^["'﻿]+|["']+$/g, ''))
  const headers = rawHeaders.map(h => {
    const normalized = normalizeHeader(h)
    return HEADER_ALIAS[normalized] ?? HEADER_ALIAS[h] ?? normalized
  })

  // Check required fields
  const missing = REQUIRED.filter(r => !headers.includes(r))
  if (missing.length > 0) {
    return { rows: [], errors: [`缺少必要欄位：${missing.join(', ')}（支援中文欄位名）`] }
  }

  const rows: CsvProductRow[] = []
  const errors: string[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    // Handle quoted values
    const values: string[] = []
    let current = ''
    let inQuote = false
    for (const ch of line) {
      if (ch === '"') { inQuote = !inQuote; continue }
      if (ch === ',' && !inQuote) { values.push(current.trim()); current = ''; continue }
      current += ch
    }
    values.push(current.trim())

    const get = (key: string) => values[headers.indexOf(key)]?.trim().replace(/^["']+|["']+$/g, '') ?? ''

    const supplierSkuId = get('supplierSkuId')
    const productName   = get('productName')
    const planCode      = get('planCode')
    const networkType   = get('networkType') || undefined
    const isNativeRaw   = get('isNativeSim').toLowerCase()
    const isNativeSim   = isNativeRaw === '是' || isNativeRaw === 'true' || isNativeRaw === '1'

    // 商品名稱通常為「美國, 10天, 3GB/天」格式：先拆三段
    const nameSegs = parseProductNameSegments(productName)

    // 國家解析優先順序（依使用者要求，以商品名稱為準，不再從 SKU/planCode 推斷）：
    //   1) CSV 「國家代碼」欄明確指定
    //   2) 商品名稱第 1 段做「包含」匹配（「日本Softbank」→ JP；「東南亞」→ SEA）
    //   3) 整段商品名稱做包含匹配（第 1 段沒抓到時的兜底）
    //   4) CSV 「適用地區」欄做完全匹配
    const explicitCode = get('countryCode').toUpperCase()
    const nameMatch = explicitCode
      ? null
      : (matchCountryInText(nameSegs.country ?? '') ?? matchCountryInText(productName))
    const countryCode  = explicitCode
      || nameMatch?.code
      || countryNameToCode(get('countryNameZh'))
      || ''
    const countryNameZh = nameMatch?.zh
      || nameSegs.country
      || get('countryNameZh')
      || ''

    const countryNameEn = get('countryNameEn') || ''
    // countryFlag: explicit → auto-derive from countryCode（自訂 code 如 SEA/ANZ 抓不到，留空）
    const countryFlag   = get('countryFlag') || countryCodeToFlag(countryCode) || ''

    // displayDays:
    //   1) CSV displayDays 欄位
    //   2) 商品名稱第 2 段（已被 parseProductNameSegments 解出）
    //   3) 整段 productName regex 抓「X天」
    const explicitDays = get('displayDays')
    let displayDays = explicitDays ? parseInt(explicitDays) : NaN
    if (isNaN(displayDays) && nameSegs.days) displayDays = nameSegs.days
    if (isNaN(displayDays) && productName) displayDays = parseDaysFromName(productName) ?? NaN

    // dataCapacity:
    //   1) CSV 流量欄
    //   2) 商品名稱第 3 段（吃到飽 / GB/MB）
    //   3) 整段 productName regex
    //   4) planCode / supplierSkuId 抓
    const dataCapacity = get('dataCapacity')
      || nameSegs.capacity
      || (productName    ? parseCapacityFromName(productName)    : null)
      || (planCode       ? parseCapacityFromName(planCode)       : null)
      || (supplierSkuId  ? parseCapacityFromName(supplierSkuId)  : null)
      || undefined

    const sellPrice = parseInt(get('sellPrice'))
    const costPrice = parseInt(get('costPrice'))
    const sortOrder = parseInt(get('sortOrder')) || 0
    const description = get('description') || undefined

    // Validation
    if (!supplierSkuId) errors.push(`第 ${i + 1} 行：供應商方案ID（supplierSkuId）不可為空`)
    if (isNaN(displayDays) || displayDays <= 0) errors.push(`第 ${i + 1} 行：無法判斷天數（請填 displayDays 欄或在商品名稱中包含如「3天」）`)
    if (isNaN(sellPrice) || sellPrice <= 0) errors.push(`第 ${i + 1} 行：售價必須為正整數`)
    if (isNaN(costPrice) || costPrice <= 0) errors.push(`第 ${i + 1} 行：成本價必須為正整數`)

    if (errors.length === 0) {
      rows.push({
        supplierSkuId,
        planCode: planCode || undefined,
        countryCode: countryCode || 'XX',
        countryNameZh: countryNameZh || supplierSkuId,
        countryNameEn,
        countryFlag,
        displayDays,
        dataCapacity,
        description,
        networkType,
        isNativeSim,
        sellPrice,
        costPrice,
        sortOrder,
      })
    }
  }

  return { rows, errors }
}

// 將 Excel 檔（xlsx/xls）的第一張 sheet 轉成 CSV 文字，重用 parseCsv 的欄位映射邏輯
async function xlsxToCsvText(file: File): Promise<string> {
  const buf = await file.arrayBuffer()
  const workbook = XLSX.read(buf, { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) throw new Error('Excel 檔案沒有任何 sheet')
  const sheet = workbook.Sheets[sheetName]
  // FS='&'（field separator）保留 default 逗號；忽略 raw 數值，全部轉字串
  return XLSX.utils.sheet_to_csv(sheet, { strip: false })
}

// POST /api/admin/products/import  (multipart/form-data, field: "file")
// 支援 CSV 與 Excel（.xlsx / .xls）。Excel 自動轉成 CSV 後走同一條解析。
export async function POST(req: NextRequest) {
  const auth = await requirePlatformAuth(req)
  if (auth instanceof NextResponse) return auth

  const formData = await req.formData()
  const file = formData.get('file')

  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: '請上傳 CSV 或 Excel 檔案' }, { status: 400 })
  }

  const f = file as File
  const isExcel = /\.(xlsx|xls)$/i.test(f.name)

  let text: string
  try {
    text = isExcel ? await xlsxToCsvText(f) : await f.text()
  } catch (err) {
    const msg = err instanceof Error ? err.message : '檔案解析失敗'
    return NextResponse.json({ error: `無法解析檔案：${msg}` }, { status: 400 })
  }

  const { rows, errors } = parseCsv(text)

  if (errors.length > 0) {
    return NextResponse.json({ error: '驗證失敗，整批未寫入', details: errors }, { status: 422 })
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: 'CSV 沒有有效資料列' }, { status: 400 })
  }

  // ── 供應商 API 驗證（非阻斷）：一次取回全部清單，批次比對 ──
  let notFound = 0
  let priceMismatch = 0
  let supplierMap: Awaited<ReturnType<typeof fetchSupplierProductMap>> | undefined

  try {
    supplierMap = await fetchSupplierProductMap(auth.tenantAdminId)
    for (const row of rows) {
      const info = supplierMap.get(row.supplierSkuId)
      if (!info) {
        notFound++
      } else if (info.productPrice !== row.costPrice) {
        priceMismatch++
      }
    }
  } catch {
    // API 不可用時略過驗證，繼續匯入；SupplierProduct 將以 CSV 資料 stub
  }

  try {
    const result = await batchCreateProducts(rows, auth.tenantAdminId, supplierMap)

    const warns: string[] = []
    if (notFound      > 0) warns.push(`供應商查無 ${notFound} 筆`)
    if (priceMismatch > 0) warns.push(`成本價不符 ${priceMismatch} 筆`)

    const parts: string[] = []
    if (result.created > 0) parts.push(`新增 ${result.created} 筆`)
    if (result.updated > 0) parts.push(`更新 ${result.updated} 筆`)
    const summary = parts.length > 0 ? parts.join('、') : `處理 ${result.count} 筆`

    return NextResponse.json({
      message:  `匯入完成（${summary}）`,
      warnings: warns.length > 0 ? warns : undefined,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '匯入失敗'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
