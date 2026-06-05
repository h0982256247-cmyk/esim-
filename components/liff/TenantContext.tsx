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
