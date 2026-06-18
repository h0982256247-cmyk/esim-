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

async function sendLineMessage(
  lineUid: string,
  text: string,
  tenantAdminId?: string | null,
  button?: { label: string; uri: string },
): Promise<void> {
  const token = await getLineToken(tenantAdminId)
  if (!token) return // 金鑰未設定時靜默跳過

  // 有 button → 用 buttons template（文字下方帶可點按鈕，如「前往我的 eSIM」）；否則純文字。
  const message = button
    ? {
        type: 'template',
        altText: text.split('\n')[0] || 'eSIM 通知',
        template: {
          type: 'buttons',
          text: text.slice(0, 160),   // buttons template 文字上限 160
          actions: [{ type: 'uri', label: button.label.slice(0, 20), uri: button.uri }],
        },
      }
    : { type: 'text', text }

  await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ to: lineUid, messages: [message] }),
  })
}

// 付款成功訊息的「訂單內容」區塊：同方案合併計量。
//   單一方案 → 內嵌一行「訂單：日本 5天 總量3GB（2 張）」
//   多方案   → 條列，header 帶總張數，避免擠成一團：
//     訂單內容（共 2 張）
//     ・日本 5天 總量3GB ×1
//     ・日本 5天 總量5GB ×1
export function formatPaidItemsBlock(items: { productName: string; qty: number }[]): string {
  const map = new Map<string, number>()
  for (const it of items) {
    const name = (it.productName || 'eSIM').trim()
    map.set(name, (map.get(name) ?? 0) + (it.qty || 1))
  }
  const entries = [...map.entries()]
  if (entries.length === 0) return '訂單：eSIM'
  if (entries.length === 1) {
    const [name, qty] = entries[0]
    return `訂單：${name}（${qty} 張）`
  }
  const totalQty = entries.reduce((s, [, q]) => s + q, 0)
  const lines = entries.map(([name, qty]) => `・${name} ×${qty}`).join('\n')
  return `訂單內容（共 ${totalQty} 張）\n${lines}`
}

// ─── 通知訊息模板 ─────────────────────────────────────────────────

function buildMessage(type: NotificationType, data: Record<string, string>): string {
  switch (type) {
    case NotificationType.COUPON_ISSUED:
      return `🎫 你收到一張新優惠券！\n折扣：${data.discount}\n類型：${data.typeName}\n立即開啟 App 查看`

    case NotificationType.ORDER_PAID:
      return `✅ 付款成功！\n${data.itemsBlock}\n金額：NT$${data.amount}\n正在為你準備 eSIM 啟動碼…`

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
  button?: { label: string; uri: string }   // LINE 訊息下方可選按鈕（如「前往我的 eSIM」）
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
  sendLineMessage(user.lineUid, content, input.tenantAdminId, input.button).catch(() => {})
}

// ─── 常用通知捷徑 ─────────────────────────────────────────────────

export async function notifyOrderPaid(
  userId: string,
  items: { productName: string; qty: number }[],
  amount: number,
  tenantAdminId?: string | null,
) {
  await sendNotification({
    userId,
    type: NotificationType.ORDER_PAID,
    data: { itemsBlock: formatPaidItemsBlock(items), amount: String(amount) },
    tenantAdminId,
  })
}

export async function notifyEsimReady(userId: string, productName: string, tenantAdminId?: string | null) {
  // 加「前往我的 eSIM」按鈕：深連結到租戶 LIFF 的訂單列表。
  // LIFF endpoint 為 /liff/<slug>，故 https://liff.line.me/<liffId>/orders 會開到列表頁。
  let button: { label: string; uri: string } | undefined
  if (tenantAdminId) {
    const admin = await prisma.platformAdmin.findUnique({
      where: { id: tenantAdminId },
      select: { liffId: true },
    })
    if (admin?.liffId) button = { label: '前往我的 eSIM', uri: `https://liff.line.me/${admin.liffId}/orders` }
  }
  await sendNotification({
    userId,
    type: NotificationType.ORDER_ESIM_READY,
    data: { productName },
    tenantAdminId,
    button,
  })
}

export async function notifyEsimPending(userId: string, productName: string, tenantAdminId?: string | null) {
  await sendNotification({
    userId,
    type: NotificationType.ORDER_ESIM_PENDING,
    data: { productName },
    tenantAdminId,
  })
}

export async function notifyCouponIssued(userId: string, discount: number, typeName: string, tenantAdminId?: string | null) {
  const pct = Math.round((1 - discount) * 100)
  await sendNotification({
    userId,
    type: NotificationType.COUPON_ISSUED,
    data: { discount: `${pct}% OFF`, typeName },
    tenantAdminId,
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

export async function notifyGiftClaimed(senderUserId: string, recipientName: string, productName: string, tenantAdminId?: string | null) {
  await sendNotification({
    userId: senderUserId,
    type: NotificationType.GIFT_CLAIMED,
    data: { recipientName, productName },
    tenantAdminId,
  })
}

export async function notifyCommissionSettled(userId: string, period: string, amount: number, tenantAdminId?: string | null) {
  await sendNotification({
    userId,
    type: NotificationType.COMMISSION_SETTLED,
    data: { period, amount: String(amount) },
    tenantAdminId,
  })
}
