'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type CartItem = {
  productId: string
  countryCode: string
  countryNameZh: string
  countryFlag: string | null
  displayDays: number
  dataCapacity: string | null
  networkType?: string | null
  isNativeSim?: boolean
  sellPrice: number
  addedAt: number
}

export type CartItemInput = Omit<CartItem, 'addedAt'>

type CartContextValue = {
  items: CartItem[]
  count: number
  subtotal: number
  has: (productId: string) => boolean
  add: (item: CartItemInput) => void
  remove: (productId: string) => void
  clear: () => void
  hydrated: boolean
}

const CartContext = createContext<CartContextValue | null>(null)
const STORAGE_KEY = 'esim_cart_v1'
const MAX_ITEMS = 20

function readStorage(): CartItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isValidItem)
  } catch {
    return []
  }
}

function isValidItem(x: unknown): x is CartItem {
  if (!x || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  return typeof o.productId === 'string'
    && typeof o.sellPrice === 'number'
    && typeof o.displayDays === 'number'
    && typeof o.countryCode === 'string'
    && typeof o.countryNameZh === 'string'
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  const [hydrated, setHydrated] = useState(false)

  // Hydrate from localStorage on mount
  useEffect(() => {
    setItems(readStorage())
    setHydrated(true)
  }, [])

  // Persist on change
  useEffect(() => {
    if (!hydrated || typeof window === 'undefined') return
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items)) } catch {}
  }, [items, hydrated])

  // Sync across tabs
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setItems(readStorage())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const add = useCallback((input: CartItemInput) => {
    setItems(prev => {
      if (prev.some(i => i.productId === input.productId)) return prev
      const next = [...prev, { ...input, addedAt: Date.now() }]
      return next.length > MAX_ITEMS ? next.slice(-MAX_ITEMS) : next
    })
  }, [])

  const remove = useCallback((productId: string) => {
    setItems(prev => prev.filter(i => i.productId !== productId))
  }, [])

  const clear = useCallback(() => setItems([]), [])

  const has = useCallback((productId: string) => items.some(i => i.productId === productId), [items])

  const value = useMemo<CartContextValue>(() => ({
    items,
    count: items.length,
    subtotal: items.reduce((s, i) => s + i.sellPrice, 0),
    has,
    add,
    remove,
    clear,
    hydrated,
  }), [items, has, add, remove, clear, hydrated])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
