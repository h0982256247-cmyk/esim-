import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAuth } from '@/lib/auth/platform'
import { promoteUserToOwner } from '@/lib/services/group'
import { prisma } from '@/lib/db/prisma'

// POST /api/platform/users/:id/promote-to-owner
// Body: { name: string; description?: string }
// 後台一鍵把會員升級為社群主：直接建出 APPROVED 狀態的社群、發 GROUP_OWNER
// 7 折券、推 LINE 通知。跳過自助申請與 PENDING 審核兩步驟。
//
// 權限：
//   - SUPER_ADMIN：可升級任何使用者
//   - PLATFORM_ADMIN：只能升級自己 tenant 下的使用者（依該 user 的 tenantAdminId）
//   - SUB_ADMIN：同 PLATFORM_ADMIN
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePlatformAuth(req)
  if (auth instanceof NextResponse) return auth

  const { id: userId } = await params
  const body = await req.json().catch(() => null) as { name?: string; description?: string } | null
  const name = body?.name?.trim()
  if (!name) return NextResponse.json({ error: '社群名稱必填' }, { status: 400 })

  // 跨租戶 guard：非 SUPER_ADMIN 只能升級自己 tenant 的會員
  if (auth.role !== 'SUPER_ADMIN') {
    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { tenantAdminId: true },
    })
    if (!target) return NextResponse.json({ error: '會員不存在' }, { status: 404 })
    if (target.tenantAdminId !== auth.tenantAdminId) {
      return NextResponse.json({ error: '無權升級其他平台的會員' }, { status: 403 })
    }
  }

  try {
    const group = await promoteUserToOwner({
      userId,
      name,
      description: body?.description?.trim() || undefined,
      // SUPER_ADMIN 沒有自己的 tenantAdminId → null（社群不掛任何 tenant）
      // PLATFORM_ADMIN / SUB_ADMIN 走 auth.tenantAdminId
      tenantAdminId: auth.tenantAdminId,
    })
    return NextResponse.json({ ok: true, group })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : '升級失敗'
    const status = message.includes('已擁有社群') ? 409 : message.includes('不存在') ? 404 : 422
    return NextResponse.json({ error: message }, { status })
  }
}
