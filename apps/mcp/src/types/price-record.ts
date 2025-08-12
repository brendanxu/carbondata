export interface PriceRecord {
  date: string
  marketCode: string
  instrumentCode: string
  price: number
  currency: string
  volume: number | null
  sourceUrl?: string
  collectedBy?: string
  metadata?: Record<string, any>
}

export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  qualityScore: number
  recordCount: number
  metadata?: {
    priceRange?: {
      min: number
      max: number
    }
    dateRange?: {
      start: number
      end: number
    }
    [key: string]: any
  }
}

export interface QualityCheckOptions {
  expectedPriceRange: { min: number; max: number }
  maxPriceChangePercent: number
  requiredFields: string[]
}

export interface QualityCheckResult {
  warnings: string[]
  passed: boolean
  score: number
}