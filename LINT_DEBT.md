# Lint 債務清單 / CI hard-gate 上線前待辦

> 目的：CI 目前 `npx eslint . || true`（lint 不擋部署）。上線前要改成硬閘門
> `npx eslint .`。這份清單追蹤「改硬閘門前要清掉的東西」。
> 範圍已修正：`eslint.config.mjs` 已忽略 `app-src/`（死碼）與 `scripts/`，
> 所以 `eslint .` 從 5000+ 雜訊降到 **79 筆真實問題（35 errors / 44 warnings）**。

## 會擋硬閘門的（errors，必須清）

`npx eslint .` 預設 **error 會 fail、warning 不會**。所以要硬閘門，先清這 35 個 error：

| 規則 | 數量 | 處理建議 |
|---|---|---|
| `react-hooks/set-state-in-effect` | ~22 | 多為「一次性 client 能力偵測 / 載入後 setState」。要嘛逐一改寫（把計算移出 effect 或用 lazy initial state，但需注意 SSR），要嘛在 config 把此規則降為 `warn`（這版 React 規則對本專案 pattern 偏嚴）。**建議：降為 warn**，再個案處理真正有問題的。 |
| 其他 react-hooks（`Cannot create components during render`／`Cannot call impure function during render`／`Cannot access refs during render`） | ~5 | 這些是真的要修的小問題（render 期間做了副作用/建元件）。逐一改。 |
| `@typescript-eslint/no-explicit-any` | 7 | 集中在單一檔案，補上型別即可。 |

## 不擋硬閘門的（warnings，可分批清）

| 規則 | 數量 | 備註 |
|---|---|---|
| `Unused eslint-disable directive`（多為 `no-console`） | ~20 | 之前 TapPay/WM 診斷 console 留下的多餘 `// eslint-disable-next-line no-console`。**快速可清**：直接刪掉那些 disable 註解（no-console 規則目前沒開）。 |
| `@next/next/no-img-element` | ~12 | LIFF 用原生 `<img>`（logo/QR/國旗）；可接受，或日後改 `next/image`。 |
| `@typescript-eslint/no-unused-vars` | ~6 | `slug`/`C`/`i`/`liff`/`_note` 等未用變數，快速可清。 |
| `react-hooks/exhaustive-deps` | ~3 | 缺依賴警告，逐一確認後補或標註。 |

## 改成硬閘門的步驟

1. ✅ 修 lint 範圍（忽略 app-src/scripts）— 已完成。
2. 清掉 7 個 `no-explicit-any` + ~5 個 misc react-hooks error。
3. `set-state-in-effect`：在 `eslint.config.mjs` 降為 `warn`（或逐一改寫）。
4. 確認 `npx eslint .` 已無 error。
5. 把 `.github/workflows/ci.yml` 的 `npx eslint . || true` 改成 `npx eslint .`。
   （此檔需 GitHub workflow 權限，由具 workflow scope 的帳號／web UI 修改。）

## 另一項 CI 強化：加 `npm run build`

目前 CI 有 `tsc --noEmit` + `vitest`，但**沒跑 `next build`**，Next.js route /
server component 的問題可能漏掉。建議在 ci.yml 加一步 `- run: npm run build`。
（`lib/db/prisma.ts` 的 client 是 lazy proxy，build 不需 DATABASE_URL，CI 無 DB env
也能 build。）
