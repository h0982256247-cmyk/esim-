import { NextRequest, NextResponse } from 'next/server'
import { getActiveProducts, getAvailableCountries } from '@/lib/services/product'
import { prisma } from '@/lib/db/prisma'
import { verifySession, SESSION_COOKIE } from '@/lib/auth/session'

// GET /api/products?country=JP
export async function GET(req: NextRequest) {
  const countryCode = req.nextUrl.searchParams.get('country') ?? undefined

  let tenantAdminId: string | null = null

  const token = req.cookies.get(SESSION_COOKIE)?.value
  if (token) {
    try {
      const session = await verifySession(token)
      const user = await prisma.user.findUnique({
        where: { id: session.userId },
        select: { tenantAdminId: true },
      })
      tenantAdminId = user?.tenantAdminId ?? null
    } catch {
      // unauthenticated — show all products
    }
  }

  const [products, countries] = await Promise.all([
    getActiveProducts(countryCode, tenantAdminId),
    getAvailableCountries(tenantAdminId),
  ])

  return NextResponse.json({ products, countries })
}
