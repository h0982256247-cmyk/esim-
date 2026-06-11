import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { requirePlatformAuth } from '@/lib/auth/platform'
import { batchCreateProducts, type CsvProductRow } from '@/lib/services/product'
import { fetchSupplierProductMap } from '@/lib/services/esim'
import { resolveCountry, parseProductNameSegments } from '@/lib/utils/country'
import { parseCapacityFromName } from '@/lib/utils/capacity'

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

    // 商品名稱通常為「菲律賓, 1天, 2GB/天」「日本Softbank, 3天, 5GB」格式：先拆段
    const nameSegs = parseProductNameSegments(productName)

    // 用 helper 解析國家。商品名稱為空或抓不到時，POST 階段會再用供應商
    // API 提供的方案名稱補強，所以這裡先得到「以 CSV 為主」的結果即可。
    const resolved = resolveCountry(
      productName,
      get('countryCode'),
      get('countryNameZh'),
      get('countryNameEn'),
      get('countryFlag'),
    )
    const countryCode   = resolved.countryCode
    const countryNameZh = resolved.countryNameZh
    const countryNameEn = resolved.countryNameEn
    const countryFlag   = resolved.countryFlag

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
    //   2) 整段 productName regex（吃到飽 / GB/MB）
    //   3) planCode / supplierSkuId 抓
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
        _rawProductName: productName,
        _matchedByName: resolved.matchedByName,
      } as CsvProductRow & { _rawProductName: string; _matchedByName: boolean })
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

  // ── 用供應商方案名稱補強國家解析 ──────────────────────────────────
  // CSV 第 3 欄商品名稱可能為空（或 header 名稱沒對到），但世界移動 API 提供
  // 的 wmInfo.productName 通常有正確國名（例如「新馬」「日本Softbank」）。
  // 當 CSV name 沒匹配出國家、且 supplier name 能匹配，覆寫該 row 的 country。
  if (supplierMap) {
    for (const row of rows as Array<CsvProductRow & { _rawProductName?: string; _matchedByName?: boolean }>) {
      if (row._matchedByName) continue  // CSV name 已解析出國家，不動
      const supplierName = supplierMap.get(row.supplierSkuId)?.productName
      if (!supplierName) continue
      const refined = resolveCountry(supplierName, '', '', '', row.countryFlag ?? '')
      if (refined.matchedByName) {
        row.countryCode   = refined.countryCode
        row.countryNameZh = refined.countryNameZh
        row.countryFlag   = refined.countryFlag
      }
    }
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
