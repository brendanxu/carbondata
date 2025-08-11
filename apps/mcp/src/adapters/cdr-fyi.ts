import { MCPAdapter } from '../types/adapter'
import { PriceRecord, ValidationResult } from '../types/price-record'
import { QualityChecker } from '../utils/quality-checker'
import { EvidenceCollector } from '../utils/evidence-collector'

export class CDRfyiAdapter implements MCPAdapter {
  name = 'CDR.fyi'
  marketCode = 'CDR'
  currency = 'USD'
  
  // CDR.fyi API端点
  private apiEndpoints = {
    prices: 'https://cdr.fyi/api/v1/prices',
    transactions: 'https://cdr.fyi/api/v1/transactions',
    markets: 'https://cdr.fyi/api/v1/markets'
  }
  
  private qualityChecker = new QualityChecker()
  private evidenceCollector = new EvidenceCollector()

  async collectData(date?: Date): Promise<{ data: PriceRecord[]; evidence: any[] }> {
    const targetDate = date || new Date()
    const allData: PriceRecord[] = []
    const evidence: any[] = []
    
    console.log(`开始采集CDR市场数据 - ${targetDate.toISOString().split('T')[0]}`)
    
    try {
      // 获取CDR价格数据
      const pricesData = await this.fetchPricesAPI(targetDate)
      allData.push(...pricesData.data)
      evidence.push(...pricesData.evidence)
      
      // 获取交易数据作为补充
      const transactionsData = await this.fetchTransactionsAPI(targetDate)
      allData.push(...transactionsData.data)
      evidence.push(...transactionsData.evidence)
      
    } catch (error) {
      console.error('CDR数据采集失败:', error)
      evidence.push({
        source: 'CDR.fyi API',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
        success: false
      })
    }
    
    return { data: allData, evidence }
  }

  private async fetchPricesAPI(targetDate: Date) {
    const data: PriceRecord[] = []
    const evidence: any[] = []
    
    try {
      const dateStr = targetDate.toISOString().split('T')[0]
      const url = `${this.apiEndpoints.prices}?date=${dateStr}&limit=100`
      
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'CarbonData/1.0 (+https://carbondata.com)'
        },
        signal: AbortSignal.timeout(15000)
      })
      
      if (!response.ok) {
        throw new Error(`CDR API Error: ${response.status} ${response.statusText}`)
      }
      
      const apiData = await response.json()
      evidence.push({
        source: 'CDR.fyi Prices API',
        url,
        timestamp: new Date().toISOString(),
        statusCode: response.status,
        recordCount: Array.isArray(apiData.data) ? apiData.data.length : 0,
        success: true
      })
      
      // 解析API响应
      if (apiData.success && Array.isArray(apiData.data)) {
        for (const item of apiData.data) {
          const record = this.parseAPIRecord(item, 'CDR.fyi Prices API', url)
          if (record) {
            data.push(record)
          }
        }
      }
      
    } catch (error) {
      evidence.push({
        source: 'CDR.fyi Prices API',
        url: this.apiEndpoints.prices,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
        success: false
      })
    }
    
    return { data, evidence }
  }

  private async fetchTransactionsAPI(targetDate: Date) {
    const data: PriceRecord[] = []
    const evidence: any[] = []
    
    try {
      const dateStr = targetDate.toISOString().split('T')[0]
      const url = `${this.apiEndpoints.transactions}?date=${dateStr}&limit=100`
      
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'CarbonData/1.0 (+https://carbondata.com)'
        },
        signal: AbortSignal.timeout(15000)
      })
      
      if (!response.ok) {
        throw new Error(`CDR Transactions API Error: ${response.status} ${response.statusText}`)
      }
      
      const apiData = await response.json()
      evidence.push({
        source: 'CDR.fyi Transactions API',
        url,
        timestamp: new Date().toISOString(),
        statusCode: response.status,
        recordCount: Array.isArray(apiData.transactions) ? apiData.transactions.length : 0,
        success: true
      })
      
      // 处理交易数据，提取平均价格
      if (apiData.success && Array.isArray(apiData.transactions)) {
        const dailyTransactions = this.aggregateTransactionsByDate(apiData.transactions)
        
        for (const [date, transactions] of Object.entries(dailyTransactions)) {
          if (this.isTargetDate(date, targetDate)) {
            const avgPrice = this.calculateWeightedAveragePrice(transactions as any[])
            const totalVolume = (transactions as any[]).reduce((sum, t) => sum + (t.volume || 0), 0)
            
            if (avgPrice > 0) {
              data.push({
                date,
                marketCode: this.marketCode,
                instrumentCode: 'CDR',
                price: avgPrice,
                currency: this.currency,
                volume: totalVolume,
                sourceUrl: url,
                collectedBy: `MCP:${this.name}`,
                metadata: {
                  source: 'CDR.fyi Transactions API',
                  transactionCount: (transactions as any[]).length,
                  aggregated: true,
                  collectionTime: new Date().toISOString()
                }
              })
            }
          }
        }
      }
      
    } catch (error) {
      evidence.push({
        source: 'CDR.fyi Transactions API',
        url: this.apiEndpoints.transactions,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
        success: false
      })
    }
    
    return { data, evidence }
  }

  private parseAPIRecord(item: any, sourceName: string, sourceUrl: string): PriceRecord | null {
    try {
      // CDR.fyi API字段映射
      const date = item.date || item.trading_date || item.timestamp?.split('T')[0]
      const price = item.price || item.settlement_price || item.avg_price
      const volume = item.volume || item.quantity || item.tonnes
      const instrumentCode = item.type || item.instrument || 'CDR'
      
      if (!date || !price || price <= 0) {
        return null
      }
      
      return {
        date: this.normalizeDate(date) || date,
        marketCode: this.marketCode,
        instrumentCode,
        price: parseFloat(price),
        currency: this.currency,
        volume: volume ? parseFloat(volume) : null,
        sourceUrl,
        collectedBy: `MCP:${this.name}`,
        metadata: {
          source: sourceName,
          rawRecord: item,
          collectionTime: new Date().toISOString()
        }
      }
      
    } catch (error) {
      console.error('解析API记录失败:', error, item)
      return null
    }
  }

  private normalizeDate(dateString: string): string | null {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return null
    
    return date.toISOString().split('T')[0]
  }

  private isTargetDate(recordDate: string, targetDate: Date): boolean {
    const target = targetDate.toISOString().split('T')[0]
    const record = new Date(recordDate).toISOString().split('T')[0]
    
    // CDR市场数据更新频率较低，检查前后5天
    const targetTime = new Date(target).getTime()
    const recordTime = new Date(record).getTime()
    const diffDays = Math.abs(targetTime - recordTime) / (1000 * 60 * 60 * 24)
    
    return diffDays <= 5
  }

  private aggregateTransactionsByDate(transactions: any[]): Record<string, any[]> {
    const grouped: Record<string, any[]> = {}
    
    for (const tx of transactions) {
      const date = tx.date || tx.trading_date || tx.timestamp?.split('T')[0]
      if (date) {
        const normalizedDate = this.normalizeDate(date)
        if (normalizedDate) {
          if (!grouped[normalizedDate]) {
            grouped[normalizedDate] = []
          }
          grouped[normalizedDate].push(tx)
        }
      }
    }
    
    return grouped
  }

  private calculateWeightedAveragePrice(transactions: any[]): number {
    let totalValue = 0
    let totalVolume = 0
    
    for (const tx of transactions) {
      const price = parseFloat(tx.price || tx.settlement_price || 0)
      const volume = parseFloat(tx.volume || tx.quantity || 1)
      
      if (price > 0 && volume > 0) {
        totalValue += price * volume
        totalVolume += volume
      }
    }
    
    return totalVolume > 0 ? totalValue / totalVolume : 0
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
      
      // 验证价格范围 (CDR价格通常在$50-500之间)
      if (record.price < 20 || record.price > 1000) {
        warnings.push(`Price $${record.price} outside typical CDR range ($20-1000)`)
      }
      
      // 验证日期有效性
      const recordDate = new Date(record.date)
      if (isNaN(recordDate.getTime())) {
        errors.push(`Invalid date: ${record.date}`)
      }
    }
    
    // 执行质量检查
    const qualityCheck = this.qualityChecker.checkQuality(records, {
      expectedPriceRange: { min: 20, max: 1000 },
      maxPriceChangePercent: 30, // CDR是新兴市场，价格波动较大
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
      // 检查CDR.fyi API健康状态
      const response = await fetch(`${this.apiEndpoints.markets}?limit=1`, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'CarbonData/1.0 (+https://carbondata.com)'
        },
        signal: AbortSignal.timeout(5000)
      })
      
      if (response.ok) {
        return { status: 'healthy', message: 'CDR.fyi API accessible and responding' }
      } else {
        return { status: 'degraded', message: `CDR.fyi API returned ${response.status}` }
      }
    } catch (error) {
      return { 
        status: 'unhealthy', 
        message: `CDR.fyi API connection failed: ${error instanceof Error ? error.message : String(error)}` 
      }
    }
  }
}