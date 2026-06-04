'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'

type OrderDetail = {
  id: string
  status: string
  totalPaid: number
  subtotal: number
  discountAmount: number
  paymentMethod: string
  paidAt: string | null
  createdAt: string
  esimRcode: string | null
  esimQrcode: string | null
  esimLpa: string | null
  activationStart: string | null
  activationEnd: string | null
  orderItems: { productName: string; qty: number; unitPrice: number }[]
}

const STATUS_LABEL: Record<string, { text: string; color: string }> = {
  PENDING: { text: '待付款', color: 'text-yellow-600' },
  PROCESSING: { text: '付款中', color: 'text-blue-600' },
  PAID: { text: '付款成功', color: 'text-green-600' },
  COMPLETED: { text: '已完成', color: 'text-green-700' },
  FAILED: { text: '付款失敗', color: 'text-red-600' },
  ESIM_PENDING: { text: 'eSIM 處理中', color: 'text-orange-600' },
  REFUNDED: { text: '已退款', color: 'text-gray-600' },
}

export default function OrderDetailPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  // 若 esim_pending 自動輪詢
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>

    const load = () =>
      fetch(`/api/orders/${id}`)
        .then(r => { if (r.status === 404) setNotFound(true); return r.json() })
        .then(d => {
          if (d.order) setOrder(d.order)
          if (d.order?.status === 'ESIM_PENDING' || d.order?.status === 'PAID') {
            timer = setInterval(load, 5000)
          }
        })
        .finally(() => setLoading(false))

    load()
    return () => clearInterval(timer)
  }, [id])

  if (loading) return <div className="flex items-center justify-center min-h-screen"><p className="text-gray-500">載入中…</p></div>
  if (notFound || !order) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-3">
      <p className="text-gray-500">訂單不存在</p>
      <button onClick={() => router.push('/orders')} className="text-blue-600 text-sm underline">查看所有訂單</button>
    </div>
  )

  const s = STATUS_LABEL[order.status] ?? { text: order.status, color: 'text-gray-600' }

  return (
    <div className="max-w-lg mx-auto px-4 pb-24">
      <div className="pt-6 mb-6">
        <button onClick={() => router.push('/orders')} className="text-blue-600 text-sm mb-3">← 所有訂單</button>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">訂單詳情</h1>
          <span className={`text-sm font-semibold ${s.color}`}>{s.text}</span>
        </div>
        <p className="text-xs text-gray-400 mt-1">#{order.id.slice(-8).toUpperCase()}</p>
      </div>

      {/* eSIM 啟動碼 */}
      {order.status === 'COMPLETED' && order.esimRcode && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 mb-4">
          <h2 className="font-bold text-blue-800 mb-3">📱 eSIM 啟動碼</h2>
          {order.esimQrcode && (
            <div className="flex justify-center mb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={order.esimQrcode} alt="eSIM QR Code" className="w-40 h-40 rounded-xl" />
            </div>
          )}
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-gray-500">啟動碼</span>
              <p className="font-mono text-gray-900 break-all">{order.esimRcode}</p>
            </div>
            {order.esimLpa && (
              <div>
                <span className="text-gray-500">LPA（iOS 一鍵安裝）</span>
                <p className="font-mono text-gray-900 text-xs break-all">{order.esimLpa}</p>
              </div>
            )}
            {order.activationStart && order.activationEnd && (
              <div>
                <span className="text-gray-500">使用期間</span>
                <p className="text-gray-900">
                  {new Date(order.activationStart).toLocaleDateString('zh-TW')} ～ {new Date(order.activationEnd).toLocaleDateString('zh-TW')}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* eSIM 處理中 */}
      {(order.status === 'ESIM_PENDING' || order.status === 'PAID') && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5 mb-4">
          <p className="font-semibold text-orange-700">eSIM 啟動碼準備中</p>
          <p className="text-sm text-orange-600 mt-1">系統正在取得啟動碼，通常在幾分鐘內完成。若超過 30 分鐘仍未收到，請聯繫客服。</p>
        </div>
      )}

      {/* 訂單資訊 */}
      <div className="bg-white rounded-xl border p-4 shadow-sm space-y-3">
        <div>
          <p className="text-sm text-gray-500">商品</p>
          <p className="font-medium">{order.orderItems[0]?.productName ?? '—'}</p>
        </div>
        <div className="border-t pt-3 space-y-1.5">
          <div className="flex justify-between text-sm text-gray-500">
            <span>商品原價</span><span>NT${order.subtotal}</span>
          </div>
          {order.discountAmount > 0 && (
            <div className="flex justify-between text-sm text-green-600">
              <span>優惠折扣</span><span>-NT${order.discountAmount}</span>
            </div>
          )}
          <div className="flex justify-between font-bold border-t pt-2">
            <span>實付金額</span><span className="text-blue-600">NT${order.totalPaid}</span>
          </div>
        </div>
        <div className="border-t pt-3 text-sm text-gray-500 space-y-1">
          <div className="flex justify-between">
            <span>付款方式</span>
            <span>{order.paymentMethod === 'CREDIT_CARD' ? '信用卡' : 'LINE Pay'}</span>
          </div>
          {order.paidAt && (
            <div className="flex justify-between">
              <span>付款時間</span>
              <span>{new Date(order.paidAt).toLocaleString('zh-TW')}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>下單時間</span>
            <span>{new Date(order.createdAt).toLocaleString('zh-TW')}</span>
          </div>
        </div>
      </div>

      {/* 客服連結 */}
      <div className="mt-4 text-center">
        <button onClick={() => router.push('/support')} className="text-gray-400 text-sm underline">需要協助？聯絡客服</button>
      </div>
    </div>
  )
}
