import { z } from 'zod'

// 市场代码枚举
export const MarketCode = z.enum(['EU', 'UK', 'CCA', 'CEA', 'CCER', 'CDR'])
export type MarketCodeType = z.infer<typeof MarketCode>

// 价格类型枚举
export const PriceType = z.enum(['SETTLEMENT', 'CLOSE', 'MID', 'OPEN', 'HIGH', 'LOW'])
export type PriceTypeType = z.infer<typeof PriceType>

// 货币枚举
export const Currency = z.enum(['EUR', 'GBP', 'USD', 'CNY'])
export type CurrencyType = z.infer<typeof Currency>

// QA状态枚举
export const QAStatus = z.enum(['PENDING', 'APPROVED', 'REJECTED', 'REVIEWING'])
export type QAStatusType = z.infer<typeof QAStatus>

// CSV导入行数据验证
export const CSVRowSchema = z.object({
  market_code: MarketCode,
  market_name: z.string().optional(),
  instrument_code: z.string().min(1),
  instrument_name: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  price: z.coerce.number().positive('Price must be positive'),
  price_type: PriceType.default('CLOSE'),
  currency: Currency,
  unit: z.string().default('tCO2e'),
  volume: z.coerce.number().nonnegative().optional(),
  venue_name: z.string().optional(),
  source_url: z.string().url().optional(),
  collected_at: z.string().datetime().optional(),
  collected_by: z.string().optional(),
  qa_status: QAStatus.default('PENDING'),
  evidence_file: z.string().optional(),
  notes: z.string().optional()
})

export type CSVRow = z.infer<typeof CSVRowSchema>

// 批量导入验证
export const ImportBatchSchema = z.object({
  rows: z.array(CSVRowSchema),
  fileName: z.string(),
  fileType: z.enum(['CSV', 'JSON', 'MANUAL']).default('CSV'),
  importedBy: z.string().optional()
})

export type ImportBatch = z.infer<typeof ImportBatchSchema>

// 价格数据查询参数验证
export const PriceQuerySchema = z.object({
  marketCode: MarketCode.optional(),
  instrumentCode: z.string().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  qaStatus: QAStatus.optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(1000).default(100),
  sortBy: z.enum(['date', 'price', 'volume']).default('date'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
})

export type PriceQuery = z.infer<typeof PriceQuerySchema>

// 数据质量检查规则
export interface QualityCheckResult {
  isValid: boolean
  warnings: string[]
  errors: string[]
}

export function performQualityChecks(
  currentRow: CSVRow,
  previousPrice?: number
): QualityCheckResult {
  const warnings: string[] = []
  const errors: string[] = []
  
  // 价格阈值检查（超过20%变动触发警告）
  if (previousPrice && currentRow.price) {
    const changePercent = Math.abs((currentRow.price - previousPrice) / previousPrice * 100)
    if (changePercent > 20) {
      warnings.push(`Price changed by ${changePercent.toFixed(1)}% from previous day`)
    }
  }
  
  // 成交量异常检查
  if (currentRow.volume !== undefined) {
    if (currentRow.volume === 0) {
      warnings.push('Volume is zero')
    } else if (currentRow.volume > 1000000) {
      warnings.push('Unusually high volume (>1M tCO2e)')
    }
  }
  
  // 日期检查（不能是未来日期）
  const rowDate = new Date(currentRow.date)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (rowDate > today) {
    errors.push('Date cannot be in the future')
  }
  
  // 市场-货币匹配检查
  const marketCurrencyMap: Record<MarketCodeType, CurrencyType> = {
    'EU': 'EUR',
    'UK': 'GBP',
    'CCA': 'USD',
    'CEA': 'CNY',
    'CCER': 'CNY',
    'CDR': 'USD'
  }
  
  const expectedCurrency = marketCurrencyMap[currentRow.market_code]
  if (expectedCurrency && currentRow.currency !== expectedCurrency) {
    warnings.push(`Currency mismatch: expected ${expectedCurrency} for ${currentRow.market_code} market`)
  }
  
  return {
    isValid: errors.length === 0,
    warnings,
    errors
  }
}

// CSV模板头部
export const CSV_TEMPLATE_HEADERS = [
  'market_code',
  'market_name',
  'instrument_code',
  'instrument_name',
  'date',
  'price',
  'price_type',
  'currency',
  'unit',
  'volume',
  'venue_name',
  'source_url',
  'collected_at',
  'collected_by',
  'qa_status',
  'evidence_file',
  'notes'
]

// 示例数据生成器
export function generateSampleData(): CSVRow[] {
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  
  return [
    {
      market_code: 'EU',
      market_name: 'EU ETS',
      instrument_code: 'EUA',
      instrument_name: 'EU Allowance',
      date: yesterday.toISOString().split('T')[0],
      price: 65.50,
      price_type: 'CLOSE',
      currency: 'EUR',
      unit: 'tCO2e',
      volume: 125000,
      venue_name: 'ICE Endex',
      source_url: 'https://www.theice.com/products/197/EUA-Futures',
      collected_at: new Date().toISOString(),
      collected_by: 'system',
      qa_status: 'PENDING',
      notes: 'Daily settlement price'
    },
    {
      market_code: 'UK',
      market_name: 'UK ETS',
      instrument_code: 'UKA',
      instrument_name: 'UK Allowance',
      date: yesterday.toISOString().split('T')[0],
      price: 35.20,
      price_type: 'CLOSE',
      currency: 'GBP',
      unit: 'tCO2e',
      volume: 85000,
      venue_name: 'ICE Endex',
      source_url: 'https://www.theice.com/products/80984935/UKA-Futures',
      collected_at: new Date().toISOString(),
      collected_by: 'system',
      qa_status: 'PENDING'
    },
    {
      market_code: 'CEA',
      market_name: '中国全国碳市场',
      instrument_code: 'CEA',
      instrument_name: '全国碳配额',
      date: yesterday.toISOString().split('T')[0],
      price: 85.60,
      price_type: 'CLOSE',
      currency: 'CNY',
      unit: 'tCO2e',
      volume: 450000,
      venue_name: '上海环境能源交易所',
      source_url: 'http://www.cneeex.com',
      collected_at: new Date().toISOString(),
      collected_by: 'system',
      qa_status: 'PENDING'
    }
  ]
}