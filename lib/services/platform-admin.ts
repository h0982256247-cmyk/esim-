import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db/prisma'
import { Prisma, PlatformAdminRole } from '@prisma/client'
import { aggregateMargin } from './finance-metrics'

// ─── 登入驗證 ─────────────────────────────────────────────────────

export async function verifyAdminCredentials(email: string, password: string) {
  const admin = await prisma.platformAdmin.findUnique({
    where: { email },
    select: { id: true, email: true, passwordHash: true, name: true, role: true, isActive: true, modules: true, parentId: true },
  })

  if (!admin || !admin.isActive) return null

  const valid = await bcrypt.compare(password, admin.passwordHash)
  if (!valid) return null

  return { id: admin.id, email: admin.email, name: admin.name, role: admin.role, modules: admin.modules, parentId: admin.parentId }
}

// ─── 建立帳號（Super Admin 建 Platform Admin，Platform Admin 建 Sub Admin）

export interface CreateAdminInput {
  email: string
  password: string
  name: string
  role: PlatformAdminRole
  parentId?: string
  createdById?: string
  modules?: string[]
  // Platform-specific fields (required when role === PLATFORM_ADMIN)
  tenantSlug?: string
  brandName?: string
  liffId?: string
  primaryColor?: string
}

export async function createAdmin(input: CreateAdminInput) {
  const passwordHash = await bcrypt.hash(input.password, 12)
  return prisma.platformAdmin.create({
    data: {
      email: input.email,
      passwordHash,
      name: input.name,
      role: input.role,
      parentId: input.parentId,
      createdById: input.createdById,
      modules: input.modules ?? [],
      ...(input.role === 'PLATFORM_ADMIN' ? {
        tenantSlug: input.tenantSlug,
        brandName: input.brandName,
        liffId: input.liffId,
        primaryColor: input.primaryColor ?? '#FFC107',
      } : {}),
    },
  })
}

export async function updateAdminPassword(adminId: string, newPassword: string) {
  const passwordHash = await bcrypt.hash(newPassword, 12)
  return prisma.platformAdmin.update({
    where: { id: adminId },
    data: { passwordHash },
  })
}

export async function toggleAdminActive(adminId: string, isActive: boolean) {
  return prisma.platformAdmin.update({
    where: { id: adminId },
    data: { isActive },
  })
}

// 僅 SUPER_ADMIN 可調整某個 Platform Admin 的讓利上限
export async function updateMaxRebateRate(adminId: string, maxRebateRate: number) {
  if (maxRebateRate < 0 || maxRebateRate > 0.30) {
    throw new Error('讓利上限須介於 0 ~ 0.30')
  }
  return prisma.platformAdmin.update({
    where: { id: adminId },
    data: { maxRebateRate },
  })
}

export async function getAllAdmins(callerId: string, callerRole: string) {
  const where = callerRole === 'SUPER_ADMIN'
    ? undefined
    : { parentId: callerId }

  return prisma.platformAdmin.findMany({
    where,
    orderBy: { createdAt: 'asc' },
    select: {
      id: true, email: true, name: true, role: true,
      isActive: true, modules: true, createdAt: true,
      maxRebateRate: true,
      parent: { select: { name: true } },
    },
  })
}

// ─── Dashboard 統計 ───────────────────────────────────────────────

// ─── 風險警示：虧損訂單 + 低毛利商品（後台儀表板紅色警示區）──────────
// 毛利定義 = (售價 − 成本) / 售價。低於 40% → 成本 > 售價 × 0.6 即示警。
const LOW_MARGIN_THRESHOLD = 0.40

export async function getRiskAlerts(tenantAdminId: string | null) {
  const tenantOrders = tenantAdminId ? Prisma.sql`AND u.tenant_admin_id = ${tenantAdminId}` : Prisma.empty
  const tenantProducts = tenantAdminId ? Prisma.sql`AND tenant_admin_id = ${tenantAdminId}` : Prisma.empty
  const costFactor = 1 - LOW_MARGIN_THRESHOLD  // 成本 / 售價 的上限（0.6）

  const [lossRows, lossCount, lowMarginExamples, lowMarginCount] = await Promise.all([
    // 虧損訂單：已付款、所有品項皆有成本快照，且實付 < 成本。取虧最多的前 8 筆。
    prisma.$queryRaw<Array<{ id: string; orderNumber: string | null; totalPaid: number; cost: number }>>`
      SELECT o.id, o.order_number AS "orderNumber", o.total_paid AS "totalPaid",
             SUM(oi.unit_cost * oi.qty)::int AS cost
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      JOIN users u ON u.id = o.user_id
      WHERE o.status IN ('PAID','COMPLETED') ${tenantOrders}
      GROUP BY o.id, o.order_number, o.total_paid
      HAVING bool_and(oi.unit_cost IS NOT NULL) AND o.total_paid < SUM(oi.unit_cost * oi.qty)
      ORDER BY (SUM(oi.unit_cost * oi.qty) - o.total_paid) DESC
      LIMIT 8`,
    prisma.$queryRaw<Array<{ n: number }>>`
      SELECT COUNT(*)::int AS n FROM (
        SELECT o.id
        FROM orders o
        JOIN order_items oi ON oi.order_id = o.id
        JOIN users u ON u.id = o.user_id
        WHERE o.status IN ('PAID','COMPLETED') ${tenantOrders}
        GROUP BY o.id, o.total_paid
        HAVING bool_and(oi.unit_cost IS NOT NULL) AND o.total_paid < SUM(oi.unit_cost * oi.qty)
      ) s`,
    prisma.$queryRaw<Array<{ id: string; countryNameZh: string; dataCapacity: string | null; displayDays: number; sellPrice: number; costPrice: number }>>`
      SELECT id, country_name_zh AS "countryNameZh", data_capacity AS "dataCapacity",
             display_days AS "displayDays", sell_price AS "sellPrice", cost_price AS "costPrice"
      FROM products
      WHERE status = 'ACTIVE' ${tenantProducts} AND sell_price > 0 AND cost_price > sell_price * ${costFactor}
      ORDER BY (cost_price::float / sell_price) DESC
      LIMIT 8`,
    prisma.$queryRaw<Array<{ n: number }>>`
      SELECT COUNT(*)::int AS n FROM products
      WHERE status = 'ACTIVE' ${tenantProducts} AND sell_price > 0 AND cost_price > sell_price * ${costFactor}`,
  ])

  return {
    threshold: LOW_MARGIN_THRESHOLD,
    lossOrders: {
      count: lossCount[0]?.n ?? 0,
      examples: lossRows.map(r => ({
        id: r.id,
        orderNo: r.orderNumber ?? r.id.slice(-8).toUpperCase(),
        totalPaid: r.totalPaid,
        cost: r.cost,
        loss: r.cost - r.totalPaid,
      })),
    },
    lowMarginProducts: {
      count: lowMarginCount[0]?.n ?? 0,
      examples: lowMarginExamples.map(p => ({
        id: p.id,
        name: `${p.countryNameZh} ${p.displayDays}天${p.dataCapacity ? ` · ${p.dataCapacity}` : ''}`,
        sellPrice: p.sellPrice,
        costPrice: p.costPrice,
        marginRate: p.sellPrice > 0 ? (p.sellPrice - p.costPrice) / p.sellPrice : 0,
      })),
    },
  }
}

export async function getDashboardStats(tenantAdminId: string | null) {
  const pendingGroupsWhere = tenantAdminId != null
    ? { status: 'PENDING' as const, tenantAdminId }
    : { status: 'PENDING' as const }

  const userTenantWhere: Prisma.UserWhereInput | undefined = tenantAdminId != null
    ? { tenantAdminId }
    : undefined

  const orderTenantWhere: Prisma.OrderWhereInput = tenantAdminId != null
    ? { user: { tenantAdminId } }
    : {}

  const paidOrderWhere: Prisma.OrderWhereInput = {
    status: { in: ['PAID', 'COMPLETED'] },
    ...orderTenantWhere,
  }

  const [
    totalUsers,
    totalOrders,
    paidOrders,
    pendingGroups,
    pendingCommissions,
    esimPendingOrders,
    margin,
    riskAlerts,
  ] = await Promise.all([
    prisma.user.count({ where: userTenantWhere }),
    prisma.order.count({ where: orderTenantWhere }),
    prisma.order.aggregate({
      where: paidOrderWhere,
      _sum: { totalPaid: true },
    }),
    prisma.group.count({ where: pendingGroupsWhere }),
    prisma.commission.aggregate({
      where: {
        status: 'PENDING',
        ...(tenantAdminId ? { group: { tenantAdminId } } : {}),
      },
      _sum: { commissionAmount: true },
    }),
    // 「付款成功但尚未發卡」：PAID 即為已付款但尚未轉 COMPLETED（發卡）的訂單，
    // 涵蓋發卡進行中與下單失敗待補發者（後者已不再轉 ESIM_PENDING）。
    prisma.order.count({ where: { status: 'PAID', ...orderTenantWhere } }),
    aggregateMargin(paidOrderWhere),
    getRiskAlerts(tenantAdminId),
  ])

  // Recent 6 months: revenue + grossProfit
  const now = new Date()
  const monthlyRevenue: { month: string; revenue: number; grossProfit: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const nextD = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
    const monthOrderWhere: Prisma.OrderWhereInput = {
      ...paidOrderWhere,
      createdAt: { gte: d, lt: nextD },
    }
    const [agg, m] = await Promise.all([
      prisma.order.aggregate({
        where: monthOrderWhere,
        _sum: { totalPaid: true },
      }),
      aggregateMargin(monthOrderWhere),
    ])
    monthlyRevenue.push({
      month: `${d.getMonth() + 1}月`,
      revenue: agg._sum.totalPaid ?? 0,
      grossProfit: m.grossProfit,
    })
  }

  // Recent 5 orders
  const recentOrders = await prisma.order.findMany({
    where: orderTenantWhere,
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: {
      id: true,
      wmOrderSn: true,
      totalPaid: true,
      status: true,
      createdAt: true,
      user: { select: { displayName: true } },
      orderItems: {
        take: 1,
        select: { productName: true },
      },
    },
  })

  return {
    totalUsers,
    totalOrders,
    totalRevenue: paidOrders._sum.totalPaid ?? 0,
    pendingGroups,
    pendingCommissions: pendingCommissions._sum.commissionAmount ?? 0,
    esimPendingOrders,
    monthlyRevenue,
    // 平台實際毛利
    eligibleRevenue: margin.eligibleRevenue,
    totalCost:       margin.cost,
    commissionPaid:  margin.commission,
    grossProfit:     margin.grossProfit,
    marginRate:      margin.marginRate,
    ordersIncluded:  margin.ordersIncluded,
    ordersExcluded:  margin.ordersExcluded,
    riskAlerts,
    recentOrders: recentOrders.map(o => ({
      id: o.id,
      orderNo: o.wmOrderSn ?? o.id.slice(-8).toUpperCase(),
      totalPaid: o.totalPaid,
      status: o.status,
      createdAt: o.createdAt.toISOString(),
      userName: o.user?.displayName ?? '—',
      productName: o.orderItems[0]?.productName ?? '—',
    })),
  }
}
