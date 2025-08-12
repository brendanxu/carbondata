export interface MCPAdapter {
  name: string
  marketCode: string
  currency: string
  
  collectData(date?: Date): Promise<{
    data: PriceRecord[]
    evidence: any[]
  }>
  
  validateData(records: PriceRecord[]): Promise<ValidationResult>
  
  getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy'
    message: string
  }>
}

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
  metadata?: Record<string, any>
}