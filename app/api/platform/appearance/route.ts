import { NextRequest, NextResponse } from 'next/server'
import { getPlatformSession } from '@/lib/auth/platform'
import { prisma } from '@/lib/db/prisma'

// GET /api/platform/appearance — 取得目前模板設定
export async function GET() {
  const session = await getPlatformSession()
  if (!session?.tenantAdminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = await prisma.platformAdmin.findUnique({
    where: { id: session.tenantAdminId },
    select: { homeTemplate: true, productsTemplate: true },
  })
  if (!admin) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ homeTemplate: admin.homeTemplate, productsTemplate: admin.productsTemplate })
}

// PATCH /api/platform/appearance — 更新模板設定
export async function PATCH(req: NextRequest) {
  const session = await getPlatformSession()
  if (!session?.tenantAdminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { homeTemplate, productsTemplate } = body

  const VALID_HOME = ['landmark', 'gradient', 'minimal']
  const VALID_PRODUCTS = ['classic', 'magazine', 'compact']

  if (homeTemplate !== undefined && !VALID_HOME.includes(homeTemplate)) {
    return NextResponse.json({ error: '無效的首頁模板' }, { status: 400 })
  }
  if (productsTemplate !== undefined && !VALID_PRODUCTS.includes(productsTemplate)) {
    return NextResponse.json({ error: '無效的商品頁模板' }, { status: 400 })
  }

  const data: Record<string, string> = {}
  if (homeTemplate !== undefined) data.homeTemplate = homeTemplate
  if (productsTemplate !== undefined) data.productsTemplate = productsTemplate

  await prisma.platformAdmin.update({
    where: { id: session.tenantAdminId },
    data,
  })

  return NextResponse.json({ ok: true })
}
