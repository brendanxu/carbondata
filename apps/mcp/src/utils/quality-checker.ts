import { PriceRecord, QualityCheckOptions, QualityCheckResult } from '../types/price-record'

export class QualityChecker {
  async calculateScore(records: PriceRecord[]): Promise<number> {
    if (records.length === 0) return 0
    
    let score = 100
    const deductions: number[] = []
    
    // Check for missing required fields
    for (const record of records) {
      if (!record.date || !record.price || !record.marketCode) {
        deductions.push(10)
      }
      if (record.price <= 0) {
        deductions.push(15)
      }
    }
    
    // Check for data consistency
    const marketCodes = new Set(records.map(r => r.marketCode))
    if (marketCodes.size > 1) {
      deductions.push(20) // Mixed market codes
    }
    
    // Check for date consistency
    const dates = records.map(r => new Date(r.date).getTime())
    const sortedDates = [...dates].sort((a, b) => a - b)
    if (JSON.stringify(dates) !== JSON.stringify(sortedDates)) {
      deductions.push(5) // Dates not in order
    }
    
    // Calculate final score
    const totalDeduction = Math.min(deductions.reduce((sum, d) => sum + d, 0), 100)
    score = Math.max(0, score - totalDeduction)
    
    return score
  }
  
  checkQuality(
    records: PriceRecord[], 
    options: QualityCheckOptions
  ): QualityCheckResult {
    const warnings: string[] = []
    let passed = true
    
    for (const record of records) {
      // Check price range
      if (record.price < options.expectedPriceRange.min || 
          record.price > options.expectedPriceRange.max) {
        warnings.push(
          `Price ${record.price} outside expected range ` +
          `(${options.expectedPriceRange.min}-${options.expectedPriceRange.max})`
        )
      }
      
      // Check required fields
      for (const field of options.requiredFields) {
        if (!record[field as keyof PriceRecord]) {
          warnings.push(`Missing required field: ${field}`)
          passed = false
        }
      }
    }
    
    // Check price changes between consecutive records
    const sortedRecords = [...records].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    )
    
    for (let i = 1; i < sortedRecords.length; i++) {
      const prevPrice = sortedRecords[i - 1].price
      const currPrice = sortedRecords[i].price
      const changePercent = Math.abs((currPrice - prevPrice) / prevPrice * 100)
      
      if (changePercent > options.maxPriceChangePercent) {
        warnings.push(
          `Large price change ${changePercent.toFixed(1)}% between ` +
          `${sortedRecords[i - 1].date} and ${sortedRecords[i].date}`
        )
      }
    }
    
    const score = this.calculateQualityScore(records, warnings.length)
    
    return {
      warnings,
      passed: passed && warnings.length < 5,
      score
    }
  }
  
  private calculateQualityScore(records: PriceRecord[], warningCount: number): number {
    let score = 100
    
    // Deduct for warnings
    score -= warningCount * 5
    
    // Bonus for complete data
    const hasVolume = records.filter(r => r.volume !== null).length / records.length
    score += hasVolume * 10
    
    // Bonus for metadata
    const hasMetadata = records.filter(r => r.metadata && Object.keys(r.metadata).length > 0).length / records.length
    score += hasMetadata * 5
    
    return Math.max(0, Math.min(100, score))
  }
}