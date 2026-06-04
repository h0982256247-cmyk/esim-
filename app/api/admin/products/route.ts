import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAuth } from '@/lib/auth/platform'
import { getAllProductsAdmin, upsertProduct, batchCreateProducts, type CsvProductRow } from '@/lib/services/product'

// GET /api/admin/products
export async function GET(req: NextRequest) {
  const auth = await requirePlatformAuth(req)
  if (auth instanceof NextResponse) return auth

  const products = await getAllProductsAdmin()
  return NextResponse.json({ products })
}

// POST /api/admin/products — single create
export async function POST(req: NextRequest) {
  const auth = await requirePlatformAuth(req)
  if (auth instanceof NextResponse) return auth

  const body = await req.json()
  const product = await upsertProduct(undefined, body)
  return NextResponse.json({ product }, { status: 201 })
}
