import { MCPAdapter } from '../types/adapter'
import { PriceRecord, ValidationResult } from '../types/price-record'
import { QualityChecker } from '../utils/quality-checker'
import { EvidenceCollector } from '../utils/evidence-collector'
import { chromium } from 'playwright'

export class CCEROfficialAdapter implements MCPAdapter {
  name = 'CCER Official'
  marketCode = 'CCER'
  currency = 'CNY'
  
  // CCER官方交易价格数据源
  sources = [
    {
      name: '广州碳排放权交易所',
      url: 'https://www.cnemission.com/article/hqxx/',
      selector: '.price-table',
      type: 'html_table' as const
    },
    {
      name: '北京绿色交易所',
      url: 'https://www.bjets.com.cn/article/jyxx/',
      selector: '.trading-info',
      type: 'html_table' as const
    }
  ]
  
  private qualityChecker = new QualityChecker()
  private evidenceCollector = new EvidenceCollector()

  async collectData(date?: Date): Promise<{ data: PriceRecord[]; evidence: any[] }> {
    const targetDate = date || new Date()
    const allData: PriceRecord[] = []
    const evidence: any[] = []
    
    console.log(`开始采集CCER市场数据 - ${targetDate.toISOString().split('T')[0]}`)
    
    const browser = await chromium.launch({ headless: true })
    
    try {
      for (const source of this.sources) {
        try {
          const sourceData = await this.collectFromSource(browser, source, targetDate)
          allData.push(...sourceData.data)
          evidence.push(...sourceData.evidence)
        } catch (error) {
          console.error(`从${source.name}采集数据失败:`, error)
          evidence.push({
            source: source.name,
            url: source.url,
            timestamp: new Date().toISOString(),
            error: error instanceof Error ? error.message : String(error),
            success: false
          })
        }
      }
    } finally {
      await browser.close()
    }
    
    return { data: allData, evidence }
  }

  private async collectFromSource(
    browser: any, 
    source: { name: string; url: string; selector: string }, 
    targetDate: Date
  ) {
    const page = await browser.newPage()
    const data: PriceRecord[] = []
    const evidence: any[] = []
    
    try {
      await page.goto(source.url, { waitUntil: 'networkidle' })
      
      // 等待数据加载
      await page.waitForSelector(source.selector, { timeout: 10000 })
      
      // 截图作为证据
      const screenshot = await page.screenshot({ fullPage: true })
      evidence.push({
        source: source.name,
        url: source.url,
        timestamp: new Date().toISOString(),
        screenshot: screenshot.toString('base64'),
        success: true
      })
      
      // 提取价格数据
      const priceData = await page.evaluate((selector) => {
        const table = document.querySelector(selector)
        if (!table) return []
        
        const rows = Array.from(table.querySelectorAll('tr'))
        const result: any[] = []
        
        for (const row of rows) {
          const cells = Array.from(row.querySelectorAll('td'))
          if (cells.length < 3) continue
          
          // 解析不同格式的表格数据
          const cellTexts = cells.map(cell => cell.textContent?.trim() || '')
          
          // 尝试匹配日期、价格模式
          for (let i = 0; i < cellTexts.length - 1; i++) {
            const dateText = cellTexts[i]
            const priceText = cellTexts[i + 1]
            
            // 匹配日期格式 (YYYY-MM-DD, YYYY/MM/DD, MM-DD)
            const dateMatch = dateText.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/) ||
                            dateText.match(/(\d{1,2})[\/\-](\d{1,2})/)
            
            // 匹配价格格式 (数字.数字, 数字,数字)
            const priceMatch = priceText.match(/(\d+(?:[,\.]\d+)?)/)
            
            if (dateMatch && priceMatch) {
              let year, month, day
              
              if (dateMatch[3]) {
                // 完整日期 YYYY-MM-DD
                year = parseInt(dateMatch[1])
                month = parseInt(dateMatch[2])
                day = parseInt(dateMatch[3])
              } else {
                // 只有月日 MM-DD，使用当前年份
                const currentYear = new Date().getFullYear()
                year = currentYear
                month = parseInt(dateMatch[1])
                day = parseInt(dateMatch[2])
              }
              
              // 处理价格数值（移除千分位分隔符）
              const price = parseFloat(priceMatch[1].replace(',', ''))
              
              if (!isNaN(price) && price > 0) {
                result.push({
                  date: `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`,
                  price: price,
                  rawText: cellTexts.join(' | ')
                })
              }
            }
          }
        }
        
        return result
      }, source.selector)
      
      // 转换为标准格式
      for (const item of priceData) {
        if (this.isValidDate(item.date)) {
          const record: PriceRecord = {
            date: item.date,
            marketCode: this.marketCode,
            instrumentCode: 'CCER',
            price: item.price,
            currency: this.currency,
            volume: null, // CCER通常不提供成交量数据
            sourceUrl: source.url,
            collectedBy: `MCP:${this.name}`,
            metadata: {
              source: source.name,
              rawData: item.rawText,
              collectionTime: new Date().toISOString()
            }
          }
          
          data.push(record)
        }
      }
      
    } finally {
      await page.close()
    }
    
    return { data, evidence }
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
      
      // 验证价格范围 (CCER一般在10-80元之间)
      if (record.price < 1 || record.price > 200) {
        warnings.push(`Price ${record.price} outside typical CCER range (1-200 CNY)`)
      }
      
      // 验证日期有效性
      const recordDate = new Date(record.date)
      if (isNaN(recordDate.getTime())) {
        errors.push(`Invalid date: ${record.date}`)
      }
      
      // 验证数据新鲜度（CCER数据更新频率较低）
      const daysSinceRecord = (Date.now() - recordDate.getTime()) / (1000 * 60 * 60 * 24)
      if (daysSinceRecord > 30) {
        warnings.push(`Data older than 30 days: ${record.date}`)
      }
    }
    
    // 检查数据质量
    const qualityCheck = this.qualityChecker.checkQuality(records, {
      expectedPriceRange: { min: 1, max: 200 },
      maxPriceChangePercent: 25, // CCER价格波动可能较大
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

  private isValidDate(dateString: string): boolean {
    const date = new Date(dateString)
    return !isNaN(date.getTime())
  }

  async getHealthStatus(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; message: string }> {
    try {
      // 简单的连通性检查
      const response = await fetch(this.sources[0].url, { 
        method: 'HEAD',
        signal: AbortSignal.timeout(5000)
      })
      
      if (response.ok) {
        return { status: 'healthy', message: 'CCER data sources accessible' }
      } else {
        return { status: 'degraded', message: `Primary source returned ${response.status}` }
      }
    } catch (error) {
      return { 
        status: 'unhealthy', 
        message: `Connection failed: ${error instanceof Error ? error.message : String(error)}` 
      }
    }
  }
}