/**
 * 一次性資料遷移：把 withdrawals.bankInfoSnapshot 內既有的「明文」帳號/分行/戶名加密。
 * 帳號改為加密落地後（見 lib/services/withdrawal.ts），此 script 補加密歷史快照。
 * idempotent：已加密者自動略過（用 decrypt 是否成功判斷，GCM 驗章誤判機率極低）。
 *
 * 執行方式（在有 DATABASE_URL 與 FIELD_ENCRYPTION_KEY 的環境）：
 *   npx tsx scripts/encrypt-withdrawal-snapshots.ts
 */

import { PrismaClient, Prisma } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { encrypt, decrypt } from '../lib/utils/crypto'

const connectionString = process.env.DATABASE_URL
if (!connectionString) { console.error('❌ DATABASE_URL 未設定'); process.exit(1) }
if (!process.env.FIELD_ENCRYPTION_KEY) { console.error('❌ FIELD_ENCRYPTION_KEY 未設定'); process.exit(1) }

const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })

// 已加密 → 原樣返回；明文 → 加密。
function encIfPlain(v: unknown): unknown {
  if (typeof v !== 'string' || !v) return v
  try { decrypt(v); return v } catch { return encrypt(v) }
}

async function main() {
  const rows = await prisma.withdrawal.findMany({ select: { id: true, bankInfoSnapshot: true } })
  let updated = 0
  for (const w of rows) {
    const snap = w.bankInfoSnapshot
    if (!snap || typeof snap !== 'object' || Array.isArray(snap)) continue
    const s = snap as Record<string, unknown>
    const next: Record<string, unknown> = {
      ...s,
      bankAccount: encIfPlain(s.bankAccount),
      bankBranch: encIfPlain(s.bankBranch),
      bankHolderName: encIfPlain(s.bankHolderName),
      // bankName 為公開資訊，明文不動
    }
    if (next.bankAccount !== s.bankAccount || next.bankBranch !== s.bankBranch || next.bankHolderName !== s.bankHolderName) {
      await prisma.withdrawal.update({
        where: { id: w.id },
        data: { bankInfoSnapshot: next as unknown as Prisma.InputJsonValue },
      })
      updated++
    }
  }
  console.log(`✅ 完成。已加密快照：${updated}/${rows.length} 筆`)
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
