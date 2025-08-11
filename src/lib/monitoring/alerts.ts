import * as Sentry from '@sentry/nextjs'

export interface AlertData {
  level: 'info' | 'warning' | 'error' | 'critical'
  title: string
  message: string
  metadata?: Record<string, any>
  source?: string
}

export class AlertSystem {
  private static instance: AlertSystem
  private webhookUrl: string | null = null
  
  constructor() {
    this.webhookUrl = process.env.ALERT_WEBHOOK_URL || null
  }
  
  public static getInstance(): AlertSystem {
    if (!AlertSystem.instance) {
      AlertSystem.instance = new AlertSystem()
    }
    return AlertSystem.instance
  }
  
  /**
   * 发送告警
   */
  async sendAlert(alert: AlertData): Promise<void> {
    try {
      // 记录到Sentry
      const sentryLevel = this.mapToSentryLevel(alert.level)
      Sentry.captureMessage(alert.message, {
        level: sentryLevel,
        tags: {
          alertLevel: alert.level,
          source: alert.source || 'system'
        },
        extra: alert.metadata
      })
      
      // 发送到Webhook（钉钉/Slack）
      if (this.webhookUrl && alert.level !== 'info') {
        await this.sendWebhookAlert(alert)
      }
      
      // 控制台日志
      this.logAlert(alert)
      
    } catch (error) {
      console.error('Failed to send alert:', error)
      // 不要让告警系统本身的错误影响主流程
    }
  }
  
  /**
   * 数据质量告警
   */
  async dataQualityAlert(market: string, issues: string[]): Promise<void> {
    await this.sendAlert({
      level: 'warning',
      title: `数据质量问题 - ${market}`,
      message: `${market}市场数据存在质量问题`,
      metadata: {
        market,
        issues,
        timestamp: new Date().toISOString()
      },
      source: 'data_quality'
    })
  }
  
  /**
   * 数据缺失告警
   */
  async dataMissingAlert(market: string, lastUpdate: Date): Promise<void> {
    const daysSince = Math.floor((Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24))
    
    await this.sendAlert({
      level: daysSince > 3 ? 'error' : 'warning',
      title: `数据更新延迟 - ${market}`,
      message: `${market}市场数据已${daysSince}天未更新`,
      metadata: {
        market,
        lastUpdate: lastUpdate.toISOString(),
        daysSince
      },
      source: 'data_freshness'
    })
  }
  
  /**
   * 系统错误告警
   */
  async systemErrorAlert(error: Error, context?: Record<string, any>): Promise<void> {
    await this.sendAlert({
      level: 'error',
      title: '系统错误',
      message: error.message,
      metadata: {
        stack: error.stack,
        ...context
      },
      source: 'system'
    })
  }
  
  /**
   * 价格异常告警
   */
  async priceAnomalyAlert(
    market: string, 
    instrument: string, 
    currentPrice: number, 
    previousPrice: number
  ): Promise<void> {
    const changePercent = Math.abs((currentPrice - previousPrice) / previousPrice * 100)
    
    await this.sendAlert({
      level: changePercent > 50 ? 'critical' : 'warning',
      title: `价格异常波动 - ${market}`,
      message: `${instrument}价格异常变动${changePercent.toFixed(1)}%`,
      metadata: {
        market,
        instrument,
        currentPrice,
        previousPrice,
        changePercent
      },
      source: 'price_monitoring'
    })
  }
  
  private mapToSentryLevel(level: AlertData['level']): Sentry.SeverityLevel {
    switch (level) {
      case 'info': return 'info'
      case 'warning': return 'warning'
      case 'error': return 'error'
      case 'critical': return 'fatal'
      default: return 'info'
    }
  }
  
  private async sendWebhookAlert(alert: AlertData): Promise<void> {
    if (!this.webhookUrl) return
    
    const payload = {
      msgtype: 'text',
      text: {
        content: `🚨 ${alert.title}\n\n${alert.message}\n\n级别: ${alert.level}\n时间: ${new Date().toLocaleString('zh-CN')}`
      }
    }
    
    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      })
      
      if (!response.ok) {
        throw new Error(`Webhook failed: ${response.status}`)
      }
    } catch (error) {
      console.error('Webhook alert failed:', error)
    }
  }
  
  private logAlert(alert: AlertData): void {
    const timestamp = new Date().toISOString()
    const logMessage = `[${timestamp}] [${alert.level.toUpperCase()}] ${alert.title}: ${alert.message}`
    
    switch (alert.level) {
      case 'info':
        console.info(logMessage)
        break
      case 'warning':
        console.warn(logMessage)
        break
      case 'error':
      case 'critical':
        console.error(logMessage)
        break
    }
    
    if (alert.metadata) {
      console.log('Alert metadata:', alert.metadata)
    }
  }
}

// 导出单例实例
export const alertSystem = AlertSystem.getInstance()

// 便捷方法
export const sendAlert = (alert: AlertData) => alertSystem.sendAlert(alert)
export const dataQualityAlert = (market: string, issues: string[]) => 
  alertSystem.dataQualityAlert(market, issues)
export const dataMissingAlert = (market: string, lastUpdate: Date) => 
  alertSystem.dataMissingAlert(market, lastUpdate)
export const systemErrorAlert = (error: Error, context?: Record<string, any>) => 
  alertSystem.systemErrorAlert(error, context)
export const priceAnomalyAlert = (market: string, instrument: string, currentPrice: number, previousPrice: number) => 
  alertSystem.priceAnomalyAlert(market, instrument, currentPrice, previousPrice)