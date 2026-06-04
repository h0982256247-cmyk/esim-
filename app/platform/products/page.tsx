'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

type Product = {
  id: string
  countryCode: string
  countryNameZh: string
  displayDays: number
  sellPrice: number
  costPrice: number
  status: string
  supplierProduct: { wmProductId: string; productName: string }
}

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'text-green-600 bg-green-50',
  INACTIVE: 'text-gray-500 bg-gray-100',
  AUTO_INACTIVE: 'text-red-500 bg-red-50',
}

export default function PlatformProductsPage() {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = () => {
    setLoading(true)
    fetch('/api/admin/products')
      .then(r => r.status === 401 ? (router.replace('/platform/login'), null) : r.json())
      .then(d => { if (d) setProducts(d.products) })
      .finally(() => setLoading(false))
  }

  useEffect(load, [router])

  const handleStatusToggle = async (id: string, currentStatus: string) => {
    const next = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    await fetch(`/api/admin/products/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    })
    load()
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadMsg(null)

    const formData = new FormData()
    formData.append('file', file)

    const r = await fetch('/api/admin/products/import', { method: 'POST', body: formData }).then(x => x.json())
    setUploading(false)
    setUploadMsg(r.message ?? r.error ?? '未知錯誤')
    if (r.message) load()
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">商品管理</h1>
        <div className="flex gap-2 items-center">
          {uploadMsg && <span className="text-sm">{uploadMsg}</span>}
          <label className={`bg-white border px-4 py-2 rounded-lg text-sm cursor-pointer hover:bg-gray-50 transition ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
            {uploading ? '匯入中…' : '📂 CSV 匯入'}
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>
        </div>
      </div>

      {loading ? <p className="text-gray-400 text-sm">載入中…</p> : (
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['國家', '天數', '售價', '成本', '供應商 SKU', '狀態', '操作'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {products.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{p.countryNameZh}</td>
                  <td className="px-4 py-3">{p.displayDays} 天</td>
                  <td className="px-4 py-3 font-semibold">NT${p.sellPrice}</td>
                  <td className="px-4 py-3 text-gray-400">NT${p.costPrice}</td>
                  <td className="px-4 py-3 text-xs text-gray-400 font-mono">{p.supplierProduct?.wmProductId ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[p.status] ?? ''}`}>{p.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleStatusToggle(p.id, p.status)}
                      className={`text-xs px-2.5 py-1 rounded-lg font-medium transition ${p.status === 'ACTIVE' ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
                    >
                      {p.status === 'ACTIVE' ? '下架' : '上架'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {products.length === 0 && <p className="text-center text-gray-400 py-8 text-sm">尚無商品，請透過 CSV 匯入</p>}
        </div>
      )}
    </div>
  )
}
