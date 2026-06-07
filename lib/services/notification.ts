import { prisma } from '@/lib/db/prisma'
import { NotificationType } from '@prisma/client'
import { safeDecrypt } from '@/lib/utils/crypto'

// ─── LINE Messaging API Push Message ─────────────────────────────

async function getLineToken(tenantAdminId?: string | null): Promise<string> {
  if (tenantAdminId) {
    const admin = await prisma.platformAdmin.findUnique({
      where: { id: tenantAdminId },
      select: { lineAccessToken: true },
    })
    if (admin?.lineAccessToken) return safeDecrypt(admin.lineAccessToken)
  }
  return process.env.LINE_CHANNEL_ACCESS_TOKEN ?? ''
}

async function sendLineMessage(lineUid: string, text: string, tenantAdminId?: string | null): Promise<void> {
  const token = await getLineToken(tenantAdminId)
  if (!token) return // 金鑰未設定時靜默跳過

  await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      to: lineUid,
      messages: [{ type: 'text', text }],
    }),
  })
}

// ─── 通知訊息模板 ─────────────────────────────────────────────────

function buildMessage(type: NotificationType, data: Record<string, string>): string {
  switch (type) {
    case NotificationType.COUPON_ISSUED:
      return `🎫 你收到一張新優惠券！\n折扣：${data.discount}\n類型：${data.typeName}\n立即開啟 App 查看`

    case NotificationType.ORDER_PAID:
      return `✅ 付款成功！\n訂單：${data.productName}\n金額：NT$${data.amount}\n正在為你準備 eSIM 啟動碼…`

    case NotificationType.ORDER_ESIM_READY:
      return `📱 eSIM 啟動碼已就緒！\n${data.productName}\n請開啟 App 查看啟動碼並安裝 eSIM。`

    case NotificationType.ORDER_ESIM_PENDING:
      return `⏳ eSIM 啟動碼準備中\n${data.productName}\n系統正在處理，完成後會再通知你。如超過 30 分鐘請聯繫客服。`

    case NotificationType.COMMISSION_SETTLED:
      return `💰 分潤已結算！\n期間：${data.period}\n金額：NT$${data.amount}\n請至社群主後台查看詳情。`

    case NotificationType.GROUP_APPROVED:
      return `🎉 恭喜！你的社群「${data.groupName}」已通過審核。\n現在可以開始邀請成員，享有分潤收益！`

    case NotificationType.GROUP_REJECTED:
      return `😔 你的社群申請「${data.groupName}」未通過審核。\n如有疑問請聯繫客服。`

    case NotificationType.GIFT_CLAIMED:
      return `🎁 ${data.recipientName} 已接受你轉贈的 eSIM\n商品：${data.productName}\n感謝你的分享！`

    default:
      return data.content ?? ''
  }
}

// ─── 主要發送函式 ─────────────────────────────────────────────────

export interface SendNotificationInput {
  userId: string
  type: NotificationType
  data: Record<string, string>
  title?: string
  tenantAdminId?: string | null
}

export async function sendNotification(input: SendNotificationInput): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { lineUid: true },
  })
  if (!user) return

  const content = buildMessage(input.type, input.data)

  // 寫入 DB
  await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      content,
      metadata: input.data,
      sentAt: new Date(),
    },
  })

  // 推送 LINE 訊息（非同步，失敗不影響主流程）
  sendLineMessage(user.lineUid, content, input.tenantAdminId).catch(() => {})
}

// ─── 常用通知捷徑 ─────────────────────────────────────────────────

export async function notifyOrderPaid(userId: string, productName: string, amount: number) {
  await sendNotification({
    userId,
    type: NotificationType.ORDER_PAID,
    data: { productName, amount: String(amount) },
  })
}

export async function notifyEsimReady(userId: string, productName: string) {
  await sendNotification({
    userId,
    type: NotificationType.ORDER_ESIM_READY,
    data: { productName },
  })
}

export async function notifyEsimPending(userId: string, productName: string) {
  await sendNotification({
    userId,
    type: NotificationType.ORDER_ESIM_PENDING,
    data: { productName },
  })
}

export async function notifyCouponIssued(userId: string, discount: number, typeName: string) {
  const pct = Math.round((1 - discount) * 100)
  await sendNotification({
    userId,
    type: NotificationType.COUPON_ISSUED,
    data: { discount: `${pct}% OFF`, typeName },
  })
}

export async function notifyGroupApproved(userId: string, groupName: string, tenantAdminId?: string | null) {
  await sendNotification({
    userId,
    type: NotificationType.GROUP_APPROVED,
    data: { groupName },
    tenantAdminId,
  })
}

export async function notifyGroupRejected(userId: string, groupName: string, tenantAdminId?: string | null) {
  await sendNotification({
    userId,
    type: NotificationType.GROUP_REJECTED,
    data: { groupName },
    tenantAdminId,
  })
}

export async function notifyGiftClaimed(senderUserId: string, recipientName: string, productName: string) {
  await sendNotification({
    userId: senderUserId,
    type: NotificationType.GIFT_CLAIMED,
    data: { recipientName, productName },
  })
}

export async function notifyCommissionSettled(userId: string, period: string, amount: number) {
  await sendNotification({
    userId,
    type: NotificationType.COMMISSION_SETTLED,
    data: { period, amount: String(amount) },
  })
}
