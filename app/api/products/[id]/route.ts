import { NextRequest, NextResponse } from 'next/server'
import { getProductById } from '@/lib/services/product'
import { ProductStatus } from '@prisma/client'

// GET /api/products/:id
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const product = await getProductById(id)

  if (!product || product.status !== ProductStatus.ACTIVE) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  }

  return NextResponse.json({ product })
}
