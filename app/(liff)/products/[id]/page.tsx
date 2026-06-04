'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'

type Product = {
  id: string
  countryCode: string
  countryNameZh: string
  countryNameEn: string
  countryFlag: string | null
  displayDays: number
  dataCapacity: string | null
  description: string | null
  sellPrice: number
}

export default function ProductDetailPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    fetch(`/api/products/${id}`)
      .then(r => {
        if (r.status === 404) { setNotFound(true); return null }
        return r.json()
      })
      .then(data => { if (data) setProduct(data.product) })
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><p className="text-gray-500">載入中…</p></div>
  }

  if (notFound || !product) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-gray-500">商品不存在或已下架</p>
        <button onClick={() => router.back()} className="text-blue-600 underline text-sm">回上一頁</button>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto">
      {/* Header */}
      <div className="px-4 pt-6 pb-4">
        <button onClick={() => router.back()} className="text-blue-600 text-sm mb-4">← 返回</button>
        <div className="flex items-center gap-2 mb-1">
          {product.countryFlag && <span className="text-3xl">{product.countryFlag}</span>}
          <div>
            <h1 className="text-xl font-bold">{product.countryNameZh}</h1>
            <p className="text-sm text-gray-400">{product.countryNameEn}</p>
          </div>
        </div>
      </div>

      {/* Product card */}
      <div className="mx-4 bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
        <p className="text-4xl font-extrabold text-blue-600 mb-1">NT${product.sellPrice}</p>
        <p className="text-gray-700 font-medium mb-3">{product.displayDays} 天方案</p>
        {product.dataCapacity && (
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
            <span>📶</span>
            <span>{product.dataCapacity}</span>
          </div>
        )}
        {product.description && (
          <p className="text-sm text-gray-500 whitespace-pre-line mt-3 pt-3 border-t">{product.description}</p>
        )}
      </div>

      {/* Sticky CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t px-4 py-3">
        <button
          onClick={() => router.push(`/checkout?productId=${product.id}`)}
          className="w-full max-w-lg mx-auto block bg-blue-600 text-white py-3 rounded-xl font-semibold text-base active:bg-blue-700 transition"
        >
          立即購買 NT${product.sellPrice}
        </button>
      </div>
    </div>
  )
}
