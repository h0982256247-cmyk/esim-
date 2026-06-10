import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { requirePlatformAuth } from '@/lib/auth/platform'
import { batchCreateProducts, type CsvProductRow } from '@/lib/services/product'
import { fetchSupplierProductMap } from '@/lib/services/esim'

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

// 從 planCode 推斷國家代碼，例如 JP-SB-1GB-3D → JP
function parseCountryFromPlanCode(planCode: string): string | null {
  const m = planCode.match(/^([A-Z]{2})-/i)
  return m ? m[1].toUpperCase() : null
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
    const countryNameZh = get('countryNameZh') || get('countryCode') // fallback
    const networkType   = get('networkType') || undefined
    const isNativeRaw   = get('isNativeSim').toLowerCase()
    const isNativeSim   = isNativeRaw === '是' || isNativeRaw === 'true' || isNativeRaw === '1'

    // countryCode: explicit → parse from planCode → fallback ''
    let countryCode = get('countryCode').toUpperCase()
    if (!countryCode && planCode) countryCode = parseCountryFromPlanCode(planCode) ?? ''

    const countryNameEn = get('countryNameEn') || ''
    // countryFlag: explicit → auto-derive from countryCode
    const countryFlag   = get('countryFlag') || countryCodeToFlag(countryCode) || ''

    // displayDays: explicit field → parse from productName
    const explicitDays = get('displayDays')
    let displayDays = explicitDays ? parseInt(explicitDays) : NaN
    if (isNaN(displayDays) && productName) {
      displayDays = parseDaysFromName(productName) ?? NaN
    }

    // dataCapacity: explicit field → parse from productName → planCode → supplierSkuId
    // SKU 常常含流量資訊（例如 WM-e-JP-SB-5GB-1D），最後 fallback 從 SKU 挖
    const dataCapacity = get('dataCapacity')
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

    return NextResponse.json({
      message:  `成功匯入 ${result.count} 筆商品`,
      warnings: warns.length > 0 ? warns : undefined,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '匯入失敗'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
