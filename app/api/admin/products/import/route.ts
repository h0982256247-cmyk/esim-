import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAuth } from '@/lib/auth/platform'
import { batchCreateProducts, type CsvProductRow } from '@/lib/services/product'

const REQUIRED_HEADERS = [
  'supplierSkuId', 'countryCode', 'countryNameZh', 'countryNameEn',
  'displayDays', 'sellPrice', 'costPrice',
]

function parseCsv(text: string): { rows: CsvProductRow[]; errors: string[] } {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return { rows: [], errors: ['CSV 檔案缺少資料列'] }

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
  const missing = REQUIRED_HEADERS.filter(h => !headers.includes(h))
  if (missing.length > 0) {
    return { rows: [], errors: [`缺少必要欄位：${missing.join(', ')}`] }
  }

  const rows: CsvProductRow[] = []
  const errors: string[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
    const get = (key: string) => values[headers.indexOf(key)] ?? ''

    const displayDays = parseInt(get('displayDays'))
    const sellPrice = parseInt(get('sellPrice'))
    const costPrice = parseInt(get('costPrice'))

    if (!get('supplierSkuId')) errors.push(`第 ${i + 1} 行：supplierSkuId 不可為空`)
    if (!get('countryCode')) errors.push(`第 ${i + 1} 行：countryCode 不可為空`)
    if (isNaN(displayDays) || displayDays <= 0) errors.push(`第 ${i + 1} 行：displayDays 必須為正整數`)
    if (isNaN(sellPrice) || sellPrice <= 0) errors.push(`第 ${i + 1} 行：sellPrice 必須為正整數`)
    if (isNaN(costPrice) || costPrice <= 0) errors.push(`第 ${i + 1} 行：costPrice 必須為正整數`)

    if (errors.length === 0) {
      rows.push({
        supplierSkuId: get('supplierSkuId'),
        countryCode: get('countryCode').toUpperCase(),
        countryNameZh: get('countryNameZh'),
        countryNameEn: get('countryNameEn'),
        countryFlag: get('countryFlag') || undefined,
        displayDays,
        dataCapacity: get('dataCapacity') || undefined,
        description: get('description') || undefined,
        sellPrice,
        costPrice,
        sortOrder: parseInt(get('sortOrder')) || 0,
      })
    }
  }

  return { rows, errors }
}

// POST /api/admin/products/import  (multipart/form-data, field: "file")
export async function POST(req: NextRequest) {
  const auth = await requirePlatformAuth(req)
  if (auth instanceof NextResponse) return auth

  const formData = await req.formData()
  const file = formData.get('file')

  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: '請上傳 CSV 檔案' }, { status: 400 })
  }

  const text = await (file as File).text()
  const { rows, errors } = parseCsv(text)

  // Any validation error → reject entire batch
  if (errors.length > 0) {
    return NextResponse.json({ error: '驗證失敗，整批未寫入', details: errors }, { status: 422 })
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: 'CSV 沒有有效資料列' }, { status: 400 })
  }

  try {
    const result = await batchCreateProducts(rows, auth.tenantAdminId)
    return NextResponse.json({ message: `成功匯入 ${result.count} 筆商品` })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '匯入失敗'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
