import { NextRequest, NextResponse } from 'next/server'
import { getActiveProducts, getAvailableCountries } from '@/lib/services/product'
import { prisma } from '@/lib/db/prisma'

// GET /api/products?country=JP&lineUid=U1234
export async function GET(req: NextRequest) {
  const countryCode = req.nextUrl.searchParams.get('country') ?? undefined
  const lineUid = req.nextUrl.searchParams.get('lineUid') ?? undefined

  let tenantAdminId: string | null = null
  if (lineUid) {
    const user = await prisma.user.findUnique({
      where: { lineUid },
      select: {
        ownedGroup: { select: { tenantAdminId: true } },
        groupMembership: { select: { group: { select: { tenantAdminId: true } } } },
      },
    })
    tenantAdminId = user?.ownedGroup?.tenantAdminId
      ?? user?.groupMembership?.group?.tenantAdminId
      ?? null
  }

  const [products, countries] = await Promise.all([
    getActiveProducts(countryCode, tenantAdminId),
    getAvailableCountries(tenantAdminId),
  ])

  return NextResponse.json({ products, countries })
}
