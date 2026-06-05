import type { HomeTemplate, ProductsTemplate } from '@/components/liff/TenantContext'
import type { ComponentType } from 'react'
import type { HomeSplashProps } from './home/LandmarkSplash'
import type { ProductsTemplateProps } from './products/types'

// ── Home splash templates ────────────────────────────────────────────────────

import LandmarkSplash from './home/LandmarkSplash'
import GradientSplash from './home/GradientSplash'
import MinimalSplash from './home/MinimalSplash'

export const HOME_TEMPLATES: Record<HomeTemplate, ComponentType<HomeSplashProps>> = {
  landmark: LandmarkSplash,
  gradient: GradientSplash,
  minimal:  MinimalSplash,
}

// ── Products page templates ──────────────────────────────────────────────────

import ClassicShop  from './products/ClassicShop'
import MagazineShop from './products/MagazineShop'
import CompactShop  from './products/CompactShop'

export const PRODUCTS_TEMPLATES: Record<ProductsTemplate, ComponentType<ProductsTemplateProps>> = {
  classic:  ClassicShop,
  magazine: MagazineShop,
  compact:  CompactShop,
}

// ── Template metadata（平台後台選擇器用）────────────────────────────────────

export const HOME_TEMPLATE_META: { key: HomeTemplate; name: string; desc: string }[] = [
  { key: 'landmark', name: '世界地標', desc: '白底插畫，艾菲爾鐵塔、富士山等地標 SVG' },
  { key: 'gradient', name: '極光漸層', desc: '深色漸層背景 + 星空動畫，高級感' },
  { key: 'minimal',  name: '極簡品牌', desc: '純白底，Logo 置中 + 細線旋轉動畫' },
]

export const PRODUCTS_TEMPLATE_META: { key: ProductsTemplate; name: string; desc: string }[] = [
  { key: 'classic',  name: '經典方格', desc: '2 欄國家格 + 卡片式方案列表' },
  { key: 'magazine', name: '雜誌橫滑', desc: '彩色橫向大卡選國家 + 沉浸式方案頁' },
  { key: 'compact',  name: '緊湊列表', desc: '密集單欄列表，適合方案數量多的商家' },
]
