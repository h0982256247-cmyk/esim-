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
  qty: number
  addedAt: number
}

export type CartItemInput = Omit<CartItem, 'addedAt' | 'qty'> & { qty?: number }

type CartContextValue = {
  items: CartItem[]
  /** Distinct line count (e.g. 3 different SKUs). */
  count: number
  /** Total physical eSIM count (sum of qty across all lines). */
  totalQty: number
  /** Sum of sellPrice × qty across all lines. */
  subtotal: number
  has: (productId: string) => boolean
  add: (item: CartItemInput) => void
  setQty: (productId: string, qty: number) => void
  remove: (productId: string) => void
  clear: () => void
  hydrated: boolean
}

const CartContext = createContext<CartContextValue | null>(null)
const STORAGE_KEY = 'esim_cart_v1'
const MAX_LINES = 20
const MAX_QTY_PER_LINE = 9

function readStorage(): CartItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    // Backfill qty for items saved before the qty field existed (v1 carts)
    return parsed.filter(isValidItem).map(it => ({ ...it, qty: typeof it.qty === 'number' && it.qty > 0 ? it.qty : 1 }))
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

function clampQty(n: number): number {
  return Math.max(1, Math.min(MAX_QTY_PER_LINE, Math.floor(n)))
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
      const existing = prev.find(i => i.productId === input.productId)
      const qty = clampQty(input.qty ?? 1)
      if (existing) {
        // Bump qty instead of adding a duplicate line
        return prev.map(i => i.productId === input.productId
          ? { ...i, qty: clampQty(i.qty + qty) }
          : i)
      }
      const next: CartItem = { ...input, qty, addedAt: Date.now() }
      const all = [...prev, next]
      return all.length > MAX_LINES ? all.slice(-MAX_LINES) : all
    })
  }, [])

  const setQty = useCallback((productId: string, qty: number) => {
    setItems(prev => prev.map(i => i.productId === productId ? { ...i, qty: clampQty(qty) } : i))
  }, [])

  const remove = useCallback((productId: string) => {
    setItems(prev => prev.filter(i => i.productId !== productId))
  }, [])

  const clear = useCallback(() => setItems([]), [])

  const has = useCallback((productId: string) => items.some(i => i.productId === productId), [items])

  const value = useMemo<CartContextValue>(() => ({
    items,
    count: items.length,
    totalQty: items.reduce((s, i) => s + i.qty, 0),
    subtotal: items.reduce((s, i) => s + i.sellPrice * i.qty, 0),
    has,
    add,
    setQty,
    remove,
    clear,
    hydrated,
  }), [items, has, add, setQty, remove, clear, hydrated])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
