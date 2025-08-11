import { MCPAdapter } from '../types/adapter'
import { PriceRecord, ValidationResult } from '../types/price-record'
import { QualityChecker } from '../utils/quality-checker'
import { EvidenceCollector } from '../utils/evidence-collector'
import { parse as parseCSV } from 'csv-parse/sync'

export class CarbCSVAdapter implements MCPAdapter {
  name = 'CARB CSV'
  marketCode = 'CCA'
  currency = 'USD'
  
  // CARB公开CSV数据源
  sources = [
    {
      name: 'CARB Auction Results',
      url: 'https://ww2.arb.ca.gov/sites/default/files/2024/auction_results.csv',
      type: 'csv' as const,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CarbonData/1.0; +https://carbondata.com)'
      }
    },
    {
      name: 'CARB Secondary Market',
      url: 'https://ww2.arb.ca.gov/sites/default/files/2024/secondary_market_data.csv',
      type: 'csv' as const,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CarbonData/1.0; +https://carbondata.com)'
      }
    }
  ]
  
  private qualityChecker = new QualityChecker()
  private evidenceCollector = new EvidenceCollector()

  async collectData(date?: Date): Promise<{ data: PriceRecord[]; evidence: any[] }> {
    const targetDate = date || new Date()
    const allData: PriceRecord[] = []
    const evidence: any[] = []
    
    console.log(`开始采集CARB市场数据 - ${targetDate.toISOString().split('T')[0]}`)
    
    for (const source of this.sources) {
      try {
        const sourceData = await this.collectFromCSVSource(source, targetDate)
        allData.push(...sourceData.data)
        evidence.push(...sourceData.evidence)
      } catch (error) {
        console.error(`从${source.name}采集CSV数据失败:`, error)
        evidence.push({
          source: source.name,
          url: source.url,
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : String(error),
          success: false
        })
      }
    }
    
    return { data: allData, evidence }
  }

  private async collectFromCSVSource(
    source: { name: string; url: string; headers?: Record<string, string> },
    targetDate: Date
  ) {
    const data: PriceRecord[] = []
    const evidence: any[] = []
    
    try {
      console.log(`正在获取CSV数据: ${source.name}`)
      
      const response = await fetch(source.url, {
        headers: {
          'Accept': 'text/csv,application/csv,text/plain',
          ...source.headers
        },
        signal: AbortSignal.timeout(30000)
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const csvContent = await response.text()
      evidence.push({
        source: source.name,
        url: source.url,
        timestamp: new Date().toISOString(),
        contentLength: csvContent.length,
        success: true,
        preview: csvContent.substring(0, 500)
      })
      
      // 解析CSV数据
      const records = parseCSV(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      })
      
      // 处理不同的CSV格式
      for (const record of records) {
        const priceRecord = this.parseCSVRecord(record, source.name, source.url)
        if (priceRecord && this.isTargetDate(priceRecord.date, targetDate)) {
          data.push(priceRecord)
        }
      }
      
    } catch (error) {
      console.error(`处理CSV数据失败: ${source.name}`, error)
      evidence.push({
        source: source.name,
        url: source.url,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
        success: false
      })
    }
    
    return { data, evidence }
  }

  private parseCSVRecord(record: any, sourceName: string, sourceUrl: string): PriceRecord | null {
    try {
      // 尝试识别不同的列名格式
      const dateFields = ['date', 'Date', 'Trading_Date', 'auction_date', 'settlement_date']
      const priceFields = ['price', 'Price', 'Settlement_Price', 'clearing_price', 'avg_price']
      const volumeFields = ['volume', 'Volume', 'Quantity', 'allowances_sold', 'total_volume']
      
      let date: string | null = null
      let price: number | null = null
      let volume: number | null = null
      
      // 查找日期字段
      for (const field of dateFields) {
        if (record[field]) {
          const dateValue = record[field]
          // 处理不同日期格式
          if (typeof dateValue === 'string') {
            const normalizedDate = this.normalizeDate(dateValue)
            if (normalizedDate) {
              date = normalizedDate
              break
            }
          }
        }
      }
      
      // 查找价格字段
      for (const field of priceFields) {
        if (record[field]) {
          const priceValue = record[field]
          const numericPrice = this.parseNumericValue(priceValue)
          if (numericPrice && numericPrice > 0) {
            price = numericPrice
            break
          }
        }
      }
      
      // 查找成交量字段
      for (const field of volumeFields) {
        if (record[field]) {
          const volumeValue = record[field]
          const numericVolume = this.parseNumericValue(volumeValue)
          if (numericVolume && numericVolume >= 0) {
            volume = numericVolume
            break
          }
        }
      }
      
      if (!date || !price) {
        return null
      }
      
      return {
        date,
        marketCode: this.marketCode,
        instrumentCode: 'CCA', // California Carbon Allowance
        price,
        currency: this.currency,
        volume,
        sourceUrl,
        collectedBy: `MCP:${this.name}`,
        metadata: {
          source: sourceName,
          rawRecord: record,
          collectionTime: new Date().toISOString()
        }
      }
      
    } catch (error) {
      console.error('解析CSV记录失败:', error, record)
      return null
    }
  }

  private normalizeDate(dateString: string): string | null {
    // 移除额外的空白和特殊字符
    const clean = dateString.trim().replace(/[^\d\/\-]/g, '')
    
    // 匹配各种日期格式
    const formats = [
      /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/, // YYYY-MM-DD
      /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/, // MM/DD/YYYY
      /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/  // MM/DD/YY
    ]
    
    for (const format of formats) {
      const match = clean.match(format)
      if (match) {
        let year: number, month: number, day: number
        
        if (format === formats[0]) {
          // YYYY-MM-DD
          year = parseInt(match[1])
          month = parseInt(match[2])
          day = parseInt(match[3])
        } else if (format === formats[1]) {
          // MM/DD/YYYY
          month = parseInt(match[1])
          day = parseInt(match[2])
          year = parseInt(match[3])
        } else {
          // MM/DD/YY
          month = parseInt(match[1])
          day = parseInt(match[2])
          year = parseInt(match[3])
          // 处理两位年份
          year = year < 50 ? 2000 + year : 1900 + year
        }
        
        // 验证日期有效性
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 2000) {
          return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`
        }
      }
    }
    
    return null
  }

  private parseNumericValue(value: any): number | null {
    if (typeof value === 'number') return value
    if (typeof value !== 'string') return null
    
    // 移除货币符号、千分位分隔符等
    const cleaned = value.replace(/[$,\s]/g, '').trim()
    const numeric = parseFloat(cleaned)
    
    return isNaN(numeric) ? null : numeric
  }

  private isTargetDate(recordDate: string, targetDate: Date): boolean {
    const target = targetDate.toISOString().split('T')[0]
    const record = new Date(recordDate).toISOString().split('T')[0]
    
    // 检查是否为目标日期或前后3天内
    const targetTime = new Date(target).getTime()
    const recordTime = new Date(record).getTime()
    const diffDays = Math.abs(targetTime - recordTime) / (1000 * 60 * 60 * 24)
    
    return diffDays <= 3
  }

  async validateData(records: PriceRecord[]): Promise<ValidationResult> {
    const errors: string[] = []
    const warnings: string[] = []
    const qualityScore = await this.qualityChecker.calculateScore(records)
    
    for (const record of records) {
      // 验证市场代码
      if (record.marketCode !== this.marketCode) {
        errors.push(`Invalid market code: ${record.marketCode}`)
      }
      
      // 验证货币
      if (record.currency !== this.currency) {
        errors.push(`Invalid currency: ${record.currency}`)
      }
      
      // 验证价格范围 (CARB价格通常在$10-50之间)
      if (record.price < 5 || record.price > 100) {
        warnings.push(`Price $${record.price} outside typical CARB range ($5-100)`)
      }
      
      // 验证日期有效性
      const recordDate = new Date(record.date)
      if (isNaN(recordDate.getTime())) {
        errors.push(`Invalid date: ${record.date}`)
      }
    }
    
    // 执行质量检查
    const qualityCheck = this.qualityChecker.checkQuality(records, {
      expectedPriceRange: { min: 5, max: 100 },
      maxPriceChangePercent: 20, // CARB价格相对稳定
      requiredFields: ['date', 'price', 'marketCode', 'instrumentCode']
    })
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings: [...warnings, ...qualityCheck.warnings],
      qualityScore,
      recordCount: records.length,
      metadata: {
        priceRange: {
          min: Math.min(...records.map(r => r.price)),
          max: Math.max(...records.map(r => r.price))
        },
        dateRange: {
          start: Math.min(...records.map(r => new Date(r.date).getTime())),
          end: Math.max(...records.map(r => new Date(r.date).getTime()))
        }
      }
    }
  }

  async getHealthStatus(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; message: string }> {
    try {
      // 检查主要数据源可用性
      const response = await fetch(this.sources[0].url, { 
        method: 'HEAD',
        signal: AbortSignal.timeout(10000)
      })
      
      if (response.ok) {
        return { status: 'healthy', message: 'CARB CSV sources accessible' }
      } else {
        return { status: 'degraded', message: `Primary CSV source returned ${response.status}` }
      }
    } catch (error) {
      return { 
        status: 'unhealthy', 
        message: `CSV source connection failed: ${error instanceof Error ? error.message : String(error)}` 
      }
    }
  }
}