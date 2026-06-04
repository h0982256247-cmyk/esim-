'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

type Product = {
  id: string
  supplierSkuId: string
  planCode: string | null
  countryCode: string
  countryNameZh: string
  countryNameEn: string
  countryFlag: string | null
  displayDays: number
  dataCapacity: string | null
  description: string | null
  networkType: string | null
  isNativeSim: boolean
  sellPrice: number
  costPrice: number
  sortOrder: number
  status: string
  supplierProduct: { wmProductId: string; productName: string } | null
}

type EditForm = {
  countryNameZh: string
  countryNameEn: string
  countryFlag: string
  displayDays: string
  dataCapacity: string
  networkType: string
  isNativeSim: boolean
  description: string
  sellPrice: string
  costPrice: string
  sortOrder: string
}

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'text-green-600 bg-green-50',
  INACTIVE: 'text-gray-500 bg-gray-100',
  AUTO_INACTIVE: 'text-red-500 bg-red-50',
}

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: '上架中',
  INACTIVE: '已下架',
  AUTO_INACTIVE: '自動下架',
}

export default function PlatformProductsPage() {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Edit modal state
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [editForm, setEditForm] = useState<EditForm | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null)

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
    if (r.message) {
      setUploadMsg({ ok: true, text: r.message })
      load()
    } else {
      const detail = r.details?.join('、') ?? ''
      setUploadMsg({ ok: false, text: `${r.error}${detail ? `：${detail}` : ''}` })
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  const openEdit = (p: Product) => {
    setEditingProduct(p)
    setEditForm({
      countryNameZh: p.countryNameZh,
      countryNameEn: p.countryNameEn,
      countryFlag: p.countryFlag ?? '',
      displayDays: String(p.displayDays),
      dataCapacity: p.dataCapacity ?? '',
      networkType: p.networkType ?? '',
      isNativeSim: p.isNativeSim,
      description: p.description ?? '',
      sellPrice: String(p.sellPrice),
      costPrice: String(p.costPrice),
      sortOrder: String(p.sortOrder),
    })
    setSaveMsg(null)
  }

  const closeEdit = () => {
    setEditingProduct(null)
    setEditForm(null)
    setSaveMsg(null)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingProduct || !editForm) return
    setSaving(true)
    setSaveMsg(null)
    const r = await fetch(`/api/admin/products/${editingProduct.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        supplierSkuId: editingProduct.supplierSkuId,
        planCode: editingProduct.planCode ?? undefined,
        countryCode: editingProduct.countryCode,
        countryNameZh: editForm.countryNameZh,
        countryNameEn: editForm.countryNameEn,
        countryFlag: editForm.countryFlag || null,
        displayDays: parseInt(editForm.displayDays),
        dataCapacity: editForm.dataCapacity || null,
        networkType: editForm.networkType || null,
        isNativeSim: editForm.isNativeSim,
        description: editForm.description || null,
        sellPrice: parseInt(editForm.sellPrice),
        costPrice: parseInt(editForm.costPrice),
        sortOrder: parseInt(editForm.sortOrder) || 0,
      }),
    }).then(x => x.json())
    setSaving(false)
    if (r.product) {
      setSaveMsg({ ok: true, text: '✅ 儲存成功' })
      load()
      setTimeout(closeEdit, 800)
    } else {
      setSaveMsg({ ok: false, text: `❌ ${r.error ?? '儲存失敗'}` })
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">商品管理</h1>
        <div className="flex gap-2 items-center">
          {uploadMsg && (
            <span className={`text-sm px-3 py-1 rounded-lg ${uploadMsg.ok ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'}`}>
              {uploadMsg.text}
            </span>
          )}
          <label className={`bg-white border px-4 py-2 rounded-lg text-sm cursor-pointer hover:bg-gray-50 transition flex items-center gap-1.5 ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
            <span>📂</span>
            {uploading ? '匯入中…' : 'CSV 匯入'}
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>
          <button
            onClick={() => {
              const headers = '供應商方案ID,plan_code,商品名稱,適用地區,是否為原生卡,網絡類型,成本價NT,售價NT'
              const example = 'WM-JP-001,JP-SB-1GB-3D,日本Softbank 3天 1GB/天,日本,否,4G/5G,150,299'
              const blob = new Blob(['﻿' + headers + '\n' + example], { type: 'text/csv;charset=utf-8' })
              const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
              a.download = 'products_template.csv'; a.click()
            }}
            className="bg-white border px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition flex items-center gap-1.5"
          >
            <span>⬇️</span> CSV 範本
          </button>
        </div>
      </div>

      {/* Table */}
      {loading ? <p className="text-gray-400 text-sm">載入中…</p> : (
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['國家', '天數', '流量', '售價', '成本', '供應商 SKU', '狀態', '操作'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {products.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span>{p.countryFlag ?? ''}</span>
                      <div>
                        <p className="font-medium">{p.countryNameZh}</p>
                        <p className="text-xs text-gray-400">{p.countryNameEn}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">{p.displayDays} 天</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{p.dataCapacity ?? '—'}</td>
                  <td className="px-4 py-3 font-semibold">NT${p.sellPrice}</td>
                  <td className="px-4 py-3 text-gray-400">NT${p.costPrice}</td>
                  <td className="px-4 py-3 text-xs text-gray-400 font-mono">{p.supplierProduct?.wmProductId ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[p.status] ?? ''}`}>
                      {STATUS_LABEL[p.status] ?? p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => openEdit(p)}
                        className="text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition"
                      >
                        編輯
                      </button>
                      <button
                        onClick={() => handleStatusToggle(p.id, p.status)}
                        className={`text-xs px-2.5 py-1 rounded-lg font-medium transition ${
                          p.status === 'ACTIVE'
                            ? 'bg-red-50 text-red-600 hover:bg-red-100'
                            : 'bg-green-50 text-green-600 hover:bg-green-100'
                        }`}
                      >
                        {p.status === 'ACTIVE' ? '下架' : '上架'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {products.length === 0 && (
            <p className="text-center text-gray-400 py-8 text-sm">尚無商品，請透過 CSV 匯入</p>
          )}
        </div>
      )}

      {/* Edit Modal */}
      {editingProduct && editForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h2 className="font-semibold">編輯商品</h2>
              <button onClick={closeEdit} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">國家中文名稱</label>
                  <input
                    type="text" required
                    value={editForm.countryNameZh}
                    onChange={e => setEditForm(f => f ? { ...f, countryNameZh: e.target.value } : f)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">英文名稱</label>
                  <input
                    type="text"
                    value={editForm.countryNameEn}
                    onChange={e => setEditForm(f => f ? { ...f, countryNameEn: e.target.value } : f)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">旗幟 Emoji</label>
                  <input
                    type="text"
                    value={editForm.countryFlag}
                    onChange={e => setEditForm(f => f ? { ...f, countryFlag: e.target.value } : f)}
                    placeholder="🇯🇵"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">天數</label>
                  <input
                    type="number" min={1} required
                    value={editForm.displayDays}
                    onChange={e => setEditForm(f => f ? { ...f, displayDays: e.target.value } : f)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">流量</label>
                  <input
                    type="text"
                    value={editForm.dataCapacity}
                    onChange={e => setEditForm(f => f ? { ...f, dataCapacity: e.target.value } : f)}
                    placeholder="1GB"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">網絡類型</label>
                  <input
                    type="text"
                    value={editForm.networkType}
                    onChange={e => setEditForm(f => f ? { ...f, networkType: e.target.value } : f)}
                    placeholder="4G/5G"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-center gap-2 pt-4">
                  <input
                    type="checkbox"
                    id="isNativeSim"
                    checked={editForm.isNativeSim}
                    onChange={e => setEditForm(f => f ? { ...f, isNativeSim: e.target.checked } : f)}
                    className="w-4 h-4 rounded"
                  />
                  <label htmlFor="isNativeSim" className="text-sm text-gray-600">原生卡 (Native SIM)</label>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">售價（NT$）</label>
                  <input
                    type="number" min={1} required
                    value={editForm.sellPrice}
                    onChange={e => setEditForm(f => f ? { ...f, sellPrice: e.target.value } : f)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">成本（NT$）</label>
                  <input
                    type="number" min={0} required
                    value={editForm.costPrice}
                    onChange={e => setEditForm(f => f ? { ...f, costPrice: e.target.value } : f)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">排序</label>
                  <input
                    type="number" min={0}
                    value={editForm.sortOrder}
                    onChange={e => setEditForm(f => f ? { ...f, sortOrder: e.target.value } : f)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-500 block mb-1">商品描述</label>
                <textarea
                  rows={2}
                  value={editForm.description}
                  onChange={e => setEditForm(f => f ? { ...f, description: e.target.value } : f)}
                  placeholder="選填"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {/* Read-only info */}
              <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500 grid grid-cols-2 gap-1">
                <span>國家代碼：<span className="font-mono font-medium text-gray-700">{editingProduct.countryCode}</span></span>
                <span>供應商 SKU：<span className="font-mono font-medium text-gray-700">{editingProduct.supplierSkuId || editingProduct.supplierProduct?.wmProductId || '—'}</span></span>
                {editingProduct.planCode && (
                  <span className="col-span-2">Plan Code：<span className="font-mono font-medium text-gray-700">{editingProduct.planCode}</span></span>
                )}
              </div>

              {saveMsg && (
                <p className={`text-sm ${saveMsg.ok ? 'text-green-600' : 'text-red-500'}`}>{saveMsg.text}</p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {saving ? '儲存中…' : '儲存'}
                </button>
                <button
                  type="button"
                  onClick={closeEdit}
                  className="flex-1 bg-gray-100 text-gray-600 py-2 rounded-lg text-sm"
                >
                  取消
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
