import { MCPAdapter } from '../types/adapter'
import { PriceRecord, ValidationResult } from '../types/price-record'
import { QualityChecker } from '../utils/quality-checker'
import { EvidenceCollector } from '../utils/evidence-collector'
import { chromium } from 'playwright'

export class CEAAdapter implements MCPAdapter {
  name = 'CEA CNEEEX'
  marketCode = 'CEA'
  currency = 'CNY'

  private qualityChecker = new QualityChecker()
  private evidenceCollector = new EvidenceCollector()

  async collectData(date?: Date): Promise<{ data: PriceRecord[]; evidence: any[] }> {
    const targetDate = date || new Date()
    const data: PriceRecord[] = []
    const evidence: any[] = []

    console.log(`开始采集CEA市场数据 - ${targetDate.toISOString().split('T')[0]}`)
    
    const browser = await chromium.launch({ headless: true })
    
    try {
      const page = await browser.newPage()
      const baseUrl = 'http://www.cneeex.com/c/2020-04-08/452044.shtml'
      
      await page.goto(baseUrl, { waitUntil: 'networkidle' })
      
      // 等待表格加载
      await page.waitForSelector('.news_content table', { timeout: 10000 })
      
      // 截图作为证据
      const screenshot = await page.screenshot({ fullPage: true })
      evidence.push({
        source: this.name,
        url: baseUrl,
        timestamp: new Date().toISOString(),
        screenshot: screenshot.toString('base64'),
        success: true
      })
      
      // 提取表格数据
      const tableData = await page.evaluate(() => {
        const table = document.querySelector('.news_content table')
        if (!table) return []
        
        const rows = Array.from(table.querySelectorAll('tr'))
        const result: any[] = []
        
        for (let i = 1; i < rows.length; i++) { // 跳过表头
          const cells = Array.from(rows[i].querySelectorAll('td'))
          if (cells.length >= 3) {
            result.push({
              date: cells[0]?.textContent?.trim() || '',
              price: cells[1]?.textContent?.trim() || '',
              volume: cells[2]?.textContent?.trim() || ''
            })
          }
        }
        
        return result
      })
      
      // 处理数据
      for (const row of tableData) {
        const dateStr = this.parseDateString(row.date)
        if (!dateStr) continue
        
        const price = this.parsePrice(row.price)
        if (price === null || price <= 0) continue
        
        const volume = this.parseVolume(row.volume)
        
        // 检查是否为目标日期附近的数据
        if (this.isTargetDate(dateStr, targetDate)) {
          const record: PriceRecord = {
            date: dateStr,
            marketCode: this.marketCode,
            instrumentCode: 'CEA',
            price,
            currency: this.currency,
            volume,
            sourceUrl: baseUrl,
            collectedBy: `MCP:${this.name}`,
            metadata: {
              source: this.name,
              rawData: row,
              collectionTime: new Date().toISOString()
            }
          }
          
          data.push(record)
        }
      }
      
      await page.close()
      
    } catch (error) {
      console.error('CEA数据采集失败:', error)
      evidence.push({
        source: this.name,
        url: 'http://www.cneeex.com/c/2020-04-08/452044.shtml',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
        success: false
      })
    } finally {
      await browser.close()
    }
    
    return { data, evidence }
  }

  private parseDateString(dateStr: string): string | null {
    try {
      // 处理可能的中文日期格式: "2024年1月15日" -> "2024-01-15"
      let normalized = dateStr.replace(/年/g, '-').replace(/月/g, '-').replace(/日/g, '')
      
      // 如果已经是标准格式，直接验证
      if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
        return normalized
      }
      
      // 尝试其他常见格式
      const date = new Date(dateStr)
      if (isNaN(date.getTime())) {
        return null
      }
      
      return date.toISOString().split('T')[0]
    } catch {
      return null
    }
  }

  private parsePrice(priceStr: string): number | null {
    try {
      // 移除货币符号、千分位分隔符、空格等
      const cleaned = priceStr.replace(/[￥¥,\s]/g, '')
      const price = parseFloat(cleaned)
      
      return isNaN(price) || price <= 0 ? null : price
    } catch {
      return null
    }
  }

  private parseVolume(volumeStr: string): number | null {
    try {
      if (!volumeStr || volumeStr === '-') return null
      
      // 处理可能的单位（万吨、吨等）
      let multiplier = 1
      if (volumeStr.includes('万')) {
        multiplier = 10000
        volumeStr = volumeStr.replace('万', '')
      }
      
      const cleaned = volumeStr.replace(/[,\s吨]/g, '')
      const volume = parseFloat(cleaned)
      
      return isNaN(volume) ? null : volume * multiplier
    } catch {
      return null
    }
  }

  private isTargetDate(recordDate: string, targetDate: Date): boolean {
    const target = targetDate.toISOString().split('T')[0]
    const record = new Date(recordDate).toISOString().split('T')[0]
    
    // CEA市场工作日交易，检查前后3天
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
      
      // 验证价格范围 (CEA价格通常在40-80元之间)
      if (record.price < 20 || record.price > 150) {
        warnings.push(`Price ${record.price} outside typical CEA range (20-150 CNY)`)
      }
      
      // 验证日期有效性
      const recordDate = new Date(record.date)
      if (isNaN(recordDate.getTime())) {
        errors.push(`Invalid date: ${record.date}`)
      }
    }
    
    // 执行质量检查
    const qualityCheck = this.qualityChecker.checkQuality(records, {
      expectedPriceRange: { min: 20, max: 150 },
      maxPriceChangePercent: 15, // CEA价格相对稳定
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
      const response = await fetch('http://www.cneeex.com', { 
        method: 'HEAD',
        signal: AbortSignal.timeout(5000)
      })
      
      if (response.ok) {
        return { status: 'healthy', message: 'CEA data source accessible' }
      } else {
        return { status: 'degraded', message: `CEA source returned ${response.status}` }
      }
    } catch (error) {
      return { 
        status: 'unhealthy', 
        message: `CEA connection failed: ${error instanceof Error ? error.message : String(error)}` 
      }
    }
  }
}