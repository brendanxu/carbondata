// 数据质量检查工具

import { ParsedRow, QualityCheck } from '../adapters/types'

/**
 * 验证价格数据质量
 */
export async function validatePriceData(
  row: ParsedRow, 
  previousRows: ParsedRow[] = []
): Promise<QualityCheck> {
  const warnings: string[] = []
  const errors: string[] = []
  let score = 100

  // 1. 基础字段验证
  if (!row.date || !/^\d{4}-\d{2}-\d{2}$/.test(row.date)) {
    errors.push('Invalid date format')
    score -= 30
  }

  if (!row.price || row.price <= 0) {
    errors.push('Invalid price value')
    score -= 30
  }

  if (!row.market_code || !['EU', 'UK', 'CCA', 'CEA', 'CCER', 'CDR'].includes(row.market_code)) {
    errors.push('Invalid market code')
    score -= 20
  }

  // 2. 业务逻辑验证
  
  // 日期不能是未来日期
  const rowDate = new Date(row.date)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (rowDate > today) {
    errors.push('Date cannot be in the future')
    score -= 25
  }

  // 市场-货币匹配检查
  const marketCurrencyMap: Record<string, string> = {
    'EU': 'EUR',
    'UK': 'GBP', 
    'CCA': 'USD',
    'CEA': 'CNY',
    'CCER': 'CNY',
    'CDR': 'USD'
  }
  
  const expectedCurrency = marketCurrencyMap[row.market_code]
  if (expectedCurrency && row.currency !== expectedCurrency) {
    warnings.push(`Currency mismatch: expected ${expectedCurrency} for ${row.market_code}`)
    score -= 10
  }

  // 3. 价格异常检测
  const sameInstrumentRows = previousRows.filter(
    r => r.market_code === row.market_code && r.instrument_code === row.instrument_code
  )
  
  if (sameInstrumentRows.length > 0) {
    const latestPrevious = sameInstrumentRows.sort((a, b) => b.date.localeCompare(a.date))[0]
    const changePercent = Math.abs((row.price - latestPrevious.price) / latestPrevious.price * 100)
    
    if (changePercent > 50) {
      warnings.push(`Extreme price change: ${changePercent.toFixed(1)}% from previous day`)
      score -= 15
    } else if (changePercent > 20) {
      warnings.push(`Large price change: ${changePercent.toFixed(1)}% from previous day`)
      score -= 5
    }
  }

  // 4. 成交量检查
  if (row.volume !== undefined) {
    if (row.volume === 0) {
      warnings.push('Zero volume detected')
      score -= 5
    } else if (row.volume > 10000000) { // 超过1000万吨
      warnings.push('Unusually high volume')
      score -= 5
    }
  }

  // 5. 市场特定规则
  if (row.market_code === 'CEA') {
    // 中国碳市场特定检查
    if (row.price > 200 || row.price < 10) {
      warnings.push('CEA price outside normal range (10-200 CNY)')
      score -= 10
    }
  }

  if (row.market_code === 'CDR') {
    // CDR市场特定检查
    if (row.price < 100 || row.price > 2000) {
      warnings.push('CDR price outside typical range (100-2000 USD)')
      score -= 10
    }
  }

  // 6. 数据来源验证
  if (!row.source_url || !isValidUrl(row.source_url)) {
    warnings.push('Invalid or missing source URL')
    score -= 5
  }

  return {
    passed: errors.length === 0,
    warnings,
    errors,
    score: Math.max(0, score)
  }
}

/**
 * 检查重复数据
 */
export function checkDuplicates(rows: ParsedRow[]): string[] {
  const duplicates: string[] = []
  const seen = new Set<string>()
  
  for (const row of rows) {
    const key = `${row.market_code}-${row.instrument_code}-${row.date}`
    if (seen.has(key)) {
      duplicates.push(`Duplicate entry: ${key}`)
    }
    seen.add(key)
  }
  
  return duplicates
}

/**
 * 数据完整性检查
 */
export function checkCompleteness(
  rows: ParsedRow[], 
  expectedDateRange: { start: string; end: string }
): string[] {
  const issues: string[] = []
  
  // 按市场分组检查
  const byMarket = new Map<string, ParsedRow[]>()
  for (const row of rows) {
    const key = `${row.market_code}-${row.instrument_code}`
    if (!byMarket.has(key)) {
      byMarket.set(key, [])
    }
    byMarket.get(key)!.push(row)
  }
  
  // 检查每个市场的数据连续性
  for (const [marketInstrument, marketRows] of byMarket) {
    const dates = marketRows.map(r => r.date).sort()
    const dateSet = new Set(dates)
    
    // 检查是否有工作日数据缺失
    const start = new Date(expectedDateRange.start)
    const end = new Date(expectedDateRange.end)
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0]
      const dayOfWeek = d.getDay()
      
      // 跳过周末（可能需要根据市场调整）
      if (dayOfWeek === 0 || dayOfWeek === 6) continue
      
      if (!dateSet.has(dateStr)) {
        issues.push(`Missing data for ${marketInstrument} on ${dateStr}`)
      }
    }
  }
  
  return issues
}

/**
 * URL有效性检查
 */
function isValidUrl(string: string): boolean {
  try {
    new URL(string)
    return true
  } catch {
    return false
  }
}

/**
 * 批量数据质量评估
 */
export async function assessBatchQuality(rows: ParsedRow[]): Promise<{
  overallScore: number
  issues: string[]
  recommendations: string[]
}> {
  const issues: string[] = []
  const recommendations: string[] = []
  let totalScore = 0
  let validRows = 0

  // 检查重复
  const duplicates = checkDuplicates(rows)
  issues.push(...duplicates)

  // 逐行质量检查
  for (const row of rows) {
    const check = await validatePriceData(row, rows)
    if (check.passed || check.score >= 60) {
      totalScore += check.score
      validRows++
    }
    issues.push(...check.errors, ...check.warnings)
  }

  const overallScore = validRows > 0 ? totalScore / validRows : 0

  // 生成建议
  if (overallScore < 70) {
    recommendations.push('数据质量偏低，建议检查数据源和采集流程')
  }
  
  if (duplicates.length > 0) {
    recommendations.push('存在重复数据，建议检查去重逻辑')
  }
  
  const errorCount = issues.filter(i => i.toLowerCase().includes('error')).length
  if (errorCount > rows.length * 0.1) {
    recommendations.push('错误率过高，建议暂停自动导入进行人工审核')
  }

  return {
    overallScore,
    issues: issues.slice(0, 100), // 限制返回的问题数量
    recommendations
  }
}