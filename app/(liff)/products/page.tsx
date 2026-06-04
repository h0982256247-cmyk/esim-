'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

type Country = {
  countryCode: string
  countryNameZh: string
  countryNameEn: string
  countryFlag: string | null
}

type Product = {
  id: string
  countryCode: string
  countryNameZh: string
  displayDays: number
  dataCapacity: string | null
  description: string | null
  sellPrice: number
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><p className="text-gray-500">載入中…</p></div>}>
      <ProductsContent />
    </Suspense>
  )
}

function ProductsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const selectedCountry = searchParams.get('country')

  const [countries, setCountries] = useState<Country[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const url = selectedCountry
      ? `/api/products?country=${selectedCountry}`
      : '/api/products'

    fetch(url)
      .then(r => r.json())
      .then(data => {
        setCountries(data.countries ?? [])
        setProducts(data.products ?? [])
      })
      .finally(() => setLoading(false))
  }, [selectedCountry])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">載入中…</p>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto pb-24">
      {/* Country selector */}
      <div className="sticky top-0 bg-white z-10 px-4 py-3 border-b">
        <h1 className="text-lg font-bold mb-2">選擇國家</h1>
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => router.push('/products')}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm border transition
              ${!selectedCountry ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300'}`}
          >
            全部
          </button>
          {countries.map(c => (
            <button
              key={c.countryCode}
              onClick={() => router.push(`/products?country=${c.countryCode}`)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm border transition
                ${selectedCountry === c.countryCode ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300'}`}
            >
              {c.countryFlag && <span className="mr-1">{c.countryFlag}</span>}
              {c.countryNameZh}
            </button>
          ))}
        </div>
      </div>

      {/* Product list */}
      <div className="px-4 py-3 space-y-3">
        {products.length === 0 && (
          <p className="text-center text-gray-400 py-10">目前沒有可購買的商品</p>
        )}
        {products.map(p => (
          <button
            key={p.id}
            onClick={() => router.push(`/products/${p.id}`)}
            className="w-full text-left bg-white rounded-xl border border-gray-200 p-4 shadow-sm active:bg-gray-50 transition"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-gray-900">
                  {p.countryNameZh} · {p.displayDays} 天
                </p>
                {p.dataCapacity && (
                  <p className="text-sm text-gray-500 mt-0.5">{p.dataCapacity}</p>
                )}
                {p.description && (
                  <p className="text-xs text-gray-400 mt-1 line-clamp-2">{p.description}</p>
                )}
              </div>
              <div className="text-right flex-shrink-0 ml-4">
                <p className="text-xl font-bold text-blue-600">NT${p.sellPrice}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
