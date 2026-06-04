'use client'

export default function SupportPage() {
  return (
    <div className="max-w-lg mx-auto px-4 pt-6">
      <h1 className="text-xl font-bold mb-4">客服中心</h1>

      <div className="space-y-3">
        <a
          href="https://lin.ee/placeholder"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-4 bg-white rounded-2xl border p-4 shadow-sm active:bg-gray-50"
        >
          <span className="text-3xl">💬</span>
          <div>
            <p className="font-semibold">LINE 客服</p>
            <p className="text-sm text-gray-400">週一至週五 10:00–18:00</p>
          </div>
          <span className="ml-auto text-gray-300">›</span>
        </a>

        <div className="bg-white rounded-2xl border p-4 shadow-sm">
          <h2 className="font-semibold mb-3 text-sm text-gray-600">常見問題</h2>
          {[
            { q: 'eSIM 如何安裝？', a: '付款完成後，在訂單頁面掃描 QR Code，或複製 LPA 碼手動輸入。iOS 14+ / Android 12+ 支援 eSIM。' },
            { q: '啟動碼多久會寄出？', a: '通常付款後 5 分鐘內完成。若超過 30 分鐘，請聯繫 LINE 客服。' },
            { q: '可以退款嗎？', a: '啟動碼尚未使用前，可聯繫客服申請退款。已安裝使用的 eSIM 恕不退款。' },
            { q: '優惠券可以合併使用嗎？', a: 'A 級券（折扣 80% 以下）不可與任何券合用；B 級券可搭配 1 張 C 級券；C 級券最多同時使用 3 張。' },
          ].map(({ q, a }) => (
            <details key={q} className="border-t py-3 first:border-t-0 first:pt-0">
              <summary className="text-sm font-medium cursor-pointer">{q}</summary>
              <p className="text-sm text-gray-500 mt-2">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </div>
  )
}
