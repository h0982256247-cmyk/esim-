import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db/prisma'
import { PlatformAdminRole } from '@prisma/client'

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
      parent: { select: { name: true } },
    },
  })
}

// ─── Dashboard 統計 ───────────────────────────────────────────────

export async function getDashboardStats(tenantAdminId: string | null) {
  const pendingGroupsWhere = tenantAdminId != null
    ? { status: 'PENDING' as const, tenantAdminId }
    : { status: 'PENDING' as const }

  const [
    totalUsers,
    totalOrders,
    paidOrders,
    pendingGroups,
    pendingCommissions,
    esimPendingOrders,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.order.count(),
    prisma.order.aggregate({
      where: { status: { in: ['PAID', 'COMPLETED'] } },
      _sum: { totalPaid: true },
    }),
    prisma.group.count({ where: pendingGroupsWhere }),
    prisma.commission.aggregate({
      where: { status: 'PENDING' },
      _sum: { commissionAmount: true },
    }),
    prisma.order.count({ where: { status: 'ESIM_PENDING' } }),
  ])

  return {
    totalUsers,
    totalOrders,
    totalRevenue: paidOrders._sum.totalPaid ?? 0,
    pendingGroups,
    pendingCommissions: pendingCommissions._sum.commissionAmount ?? 0,
    esimPendingOrders,
  }
}
