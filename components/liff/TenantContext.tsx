'use client'

import { createContext, useContext, type ReactNode } from 'react'

export interface TenantConfig {
  id: string
  slug: string
  brandName: string
  liffId: string
  logoUrl: string | null
  primaryColor: string | null
}

const TenantContext = createContext<TenantConfig | null>(null)

export function TenantProvider({ children, tenant }: { children: ReactNode; tenant: TenantConfig | null }) {
  return <TenantContext.Provider value={tenant}>{children}</TenantContext.Provider>
}

export function useTenant(): TenantConfig | null {
  return useContext(TenantContext)
}

// Returns the primary color or the default brand blue
export function usePrimaryColor(): string {
  const tenant = useTenant()
  return tenant?.primaryColor ?? '#0284c7'
}

// ─── Color utilities ────────────────────────────────────────────────────────

/** Convert #rrggbb (or #rgb) to { r, g, b } */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const full = hex.replace(/^#([a-f\d])([a-f\d])([a-f\d])$/i, '#$1$1$2$2$3$3')
  const m = /^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(full)
  return m
    ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) }
    : null
}

/**
 * Decide whether to use dark or light text on a coloured background.
 * Uses the W3C perceived brightness formula.
 */
function onColor(hex: string): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return '#ffffff'
  const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000
  return brightness > 160 ? '#1a1a1a' : '#ffffff'
}

/**
 * Full colour palette derived from the tenant's primary colour.
 *
 * primary    — main brand colour          → CTA buttons, active tab indicator, key links
 * onPrimary  — text on primary background → button labels (auto white or dark)
 * light      — 8 % tint                  → selected card / item backgrounds
 * soft       — 14 % tint                 → hover states, chip backgrounds
 * border     — 28 % tint                 → borders on selected/active items
 * muted      — 50 % tint                 → secondary accent text, minor icons
 */
export interface TenantColors {
  primary: string
  onPrimary: string
  light: string
  soft: string
  border: string
  muted: string
}

export function useTenantColors(): TenantColors {
  const primary = usePrimaryColor()
  const rgb = hexToRgb(primary)
  const a = (opacity: number): string =>
    rgb ? `rgba(${rgb.r},${rgb.g},${rgb.b},${opacity})` : primary

  return {
    primary,
    onPrimary: onColor(primary),
    light:  a(0.08),
    soft:   a(0.14),
    border: a(0.28),
    muted:  a(0.50),
  }
}
