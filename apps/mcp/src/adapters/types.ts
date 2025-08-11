// MCP适配器统一接口定义

export interface RawEvidence {
  filePath: string
  sha256: string
  fileType: 'screenshot' | 'csv' | 'json' | 'html'
  metadata?: Record<string, any>
}

export interface ParsedRow {
  market_code: 'EU' | 'UK' | 'CCA' | 'CEA' | 'CCER' | 'CDR'
  instrument_code: string
  date: string // YYYY-MM-DD（交易日）
  price: number
  price_type: 'settlement' | 'close' | 'mid'
  currency: 'EUR' | 'GBP' | 'USD' | 'CNY'
  unit: 'tCO2e'
  volume?: number // 吨；CDR/CCER 可暂存"样本量"并在 notes 标注
  venue_name?: string
  source_url: string
  notes?: string
}

export interface AdapterResult {
  rows: ParsedRow[]
  evidences: RawEvidence[]
  warnings: string[]
  errors: string[]
  metadata: {
    adapter_id: string
    execution_time: number
    data_date: string
    collected_at: string
  }
}

export interface Adapter {
  id: string
  name: string
  description: string
  market_codes: string[]
  schedule?: string // cron表达式
  run: (params?: Record<string, unknown>) => Promise<AdapterResult>
}

// 通用抓取参数
export interface FetchParams {
  timeout?: number
  retries?: number
  headers?: Record<string, string>
  proxy?: string
}

// 质量检查结果
export interface QualityCheck {
  passed: boolean
  warnings: string[]
  errors: string[]
  score: number // 0-100
}

// 调度任务配置
export interface ScheduleConfig {
  adapter_id: string
  cron: string
  timezone: string
  enabled: boolean
  retry_policy: {
    max_retries: number
    backoff_factor: number
    max_delay: number
  }
  quality_threshold: number // 最低质量分数
}