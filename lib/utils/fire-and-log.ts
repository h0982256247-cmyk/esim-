// business-critical 的 fire-and-forget async（付款後開卡 / 分潤 / 發券）失敗不可
// 靜默吞錯（CLAUDE.md 守則 F）。過去用 `.catch(()=>{})`，導致「付款成功卻沒收到
// eSIM」這類問題完全沒有任何痕跡、極難 debug。至少把錯誤記到 log（Vercel 可見），
// 但仍不阻塞主流程（webhook 要照常回 200）。
export function fireAndLog(label: string, ctx: unknown, p: Promise<unknown>): void {
  p.catch(e => {
    // eslint-disable-next-line no-console
    console.error(`[fire-and-log] ${label} failed`, ctx, e instanceof Error ? e.message : e)
  })
}
