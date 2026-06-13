@AGENTS.md

# 專案重點規則（改任何東西前先對照；每條都對應過真實 bug）

## 架構
- `app-src/` 是死碼：它是獨立的巢狀 git repo、不在 build 範圍內。Live app 只有根目錄 `app/`；LIFF 一律走 `app/liff/[slug]/`，改任何 user-facing 行為只動這裡，別碰 `app-src/`。
- 多租戶：每個 tenant 有自己的 `liffId`、`tenantPaymentConfig`（TapPay）、`tenantEsimConfig`（世界移動）。設定一律 by-tenant 解析，別把全域 env 當預設。世界移動「測試/正式」是兩台獨立主機，各有不同 merchantId/deptId/token 與 wmproductId。

## LIFF 導頁
- 所有路徑用 `useLiffBase()` 取 `${base}`（= `/liff/<slug>`）拼接；禁止寫死 `/orders`、`/products` 等無前綴路徑，否則使用者掉出 slug、tenant context 丟失。
- 送後端的 returnUrl 也要先拼 base；付款 3DS/LINE Pay 的回跳網址要用 `liff.permanentLink` 轉成 `liff.line.me` 連結，才會跳回 LINE 內的 LIFF（用一般 https 會被 LINE 用外部瀏覽器開）。

## proxy.ts API 閘門（最容易踩）
- `proxy.ts` 對所有 `/api/*` 要求 session，除非列在 `PUBLIC_API`。任何「第三方 server→server 回呼」（TapPay notify、世界移動 webhook、Vercel cron）一定要加進 `PUBLIC_API`，否則會在 route 執行前就被 401——症狀是「對方明明有送、訂單卻不動」。route 內部要自己驗章。

## 金流 / eSIM 串接
- TapPay 的 backend_notify **不帶 x-api-key**，別用 header 比對驗章；改用 body 的 `rec_trade_id` 打 Record API 回查。注意 Record API 查到資料時 `status` 會回 **2（"End of list"）**、不是 0，別誤判為失敗。
- 世界移動 `wmproductId` 必須來自 `myQueryAll` 同步（後台商品匯入），格式像 `WM_000001`；不可手填自創 SKU（如 `WM-e-JP-T3-5D`），否則 WM 拒單、付款成功卻發不出卡。
- eSIM / 訂單狀態的文案與配色單一來源是 `lib/esimStatus.ts` 的 `deriveEsimStatus()`，列表與詳情都從這裡取，勿各自寫一套。

## 驗證
- 改完一律跑 `npx tsc --noEmit`（應 0 錯）。
- sandbox 顯示「付款成功」≠ 系統真的收到：用 DB / Record API / log 確認，別只看畫面。
