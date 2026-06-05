import type { TenantColors } from '@/components/liff/TenantContext'
import type { CouponItem } from '@/lib/utils/coupon-combo'

export interface Country {
  countryCode: string
  countryNameZh: string
  countryNameEn: string
  countryFlag: string | null
}

export interface Product {
  id: string
  countryCode: string
  countryNameZh: string
  countryNameEn: string
  displayDays: number
  dataCapacity: string | null
  description: string | null
  sellPrice: number
}

export interface ProductsTemplateProps {
  slug: string
  countries: Country[]
  products: Product[]
  coupons: CouponItem[]
  selectedCountry: string | null
  showSetup: boolean
  colors: TenantColors
  logoUrl: string | null
  onSelectCountry: (code: string) => void
  onSelectProduct: (id: string) => void
  onDismissSetup: () => void
  onBack: () => void
}
