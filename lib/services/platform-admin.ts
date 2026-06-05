import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db/prisma'
import { Prisma, PlatformAdminRole } from '@prisma/client'

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

  const [
    totalUsers,
    totalOrders,
    paidOrders,
    pendingGroups,
    pendingCommissions,
    esimPendingOrders,
  ] = await Promise.all([
    prisma.user.count({ where: userTenantWhere }),
    prisma.order.count({ where: orderTenantWhere }),
    prisma.order.aggregate({
      where: { status: { in: ['PAID', 'COMPLETED'] }, ...orderTenantWhere },
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
    prisma.order.count({ where: { status: 'ESIM_PENDING', ...orderTenantWhere } }),
  ])

  // Recent 6 months revenue (for chart)
  const now = new Date()
  const monthlyRevenue: { month: string; revenue: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const nextD = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
    const agg = await prisma.order.aggregate({
      where: {
        status: { in: ['PAID', 'COMPLETED'] },
        createdAt: { gte: d, lt: nextD },
        ...orderTenantWhere,
      },
      _sum: { totalPaid: true },
    })
    monthlyRevenue.push({
      month: `${d.getMonth() + 1}月`,
      revenue: agg._sum.totalPaid ?? 0,
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
