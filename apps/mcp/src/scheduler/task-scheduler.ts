import { MCPAdapter } from '../types/adapter'
import { PriceRecord } from '../types/price-record'
import { CEAAdapter } from '../adapters/cea-cneeex'
import { CCEROfficialAdapter } from '../adapters/ccer-official'
import { CarbCSVAdapter } from '../adapters/carb-csv'
import { CDRfyiAdapter } from '../adapters/cdr-fyi'
import cron from 'node-cron'

interface ScheduledTask {
  id: string
  adapter: MCPAdapter
  schedule: string
  lastRun?: Date
  nextRun?: Date
  enabled: boolean
  retryCount: number
  maxRetries: number
}

interface TaskExecutionResult {
  taskId: string
  success: boolean
  recordCount: number
  errors: string[]
  warnings: string[]
  executionTime: number
  timestamp: Date
}

export class TaskScheduler {
  private tasks: Map<string, ScheduledTask> = new Map()
  private executionHistory: TaskExecutionResult[] = []
  private isRunning = false
  
  constructor() {
    this.initializeAdapters()
  }

  private initializeAdapters() {
    const adapters = [
      new CEAAdapter(),
      new CCEROfficialAdapter(), 
      new CarbCSVAdapter(),
      new CDRfyiAdapter()
    ]
    
    // 为每个适配器创建调度任务
    for (const adapter of adapters) {
      const schedule = this.getScheduleForMarket(adapter.marketCode)
      const task: ScheduledTask = {
        id: `${adapter.marketCode.toLowerCase()}-daily`,
        adapter,
        schedule,
        enabled: true,
        retryCount: 0,
        maxRetries: 3
      }
      
      this.tasks.set(task.id, task)
    }
  }

  private getScheduleForMarket(marketCode: string): string {
    // 根据不同市场的交易时间设置抓取计划
    const schedules: Record<string, string> = {
      'CEA': '30 9 * * 1-5',    // 北京时间17:30工作日 (UTC 9:30)
      'CCER': '45 9 * * 1-5',   // 北京时间17:45工作日 (UTC 9:45)
      'CCA': '0 23 * * 1-5',    // 加州时间16:00工作日 (UTC 23:00)
      'CDR': '0 1 * * *',       // 每日UTC 1:00执行
    }
    
    return schedules[marketCode] || '0 2 * * *' // 默认UTC 2:00
  }

  async start() {
    if (this.isRunning) {
      console.log('Task scheduler is already running')
      return
    }
    
    this.isRunning = true
    console.log('Starting MCP task scheduler...')
    
    // 为每个任务设置cron调度
    for (const [taskId, task] of this.tasks) {
      if (task.enabled) {
        cron.schedule(task.schedule, async () => {
          await this.executeTask(taskId)
        }, {
          scheduled: true,
          timezone: 'UTC'
        })
        
        // 计算下次执行时间
        task.nextRun = this.calculateNextRun(task.schedule)
        console.log(`Scheduled task ${taskId}: ${task.schedule} (next: ${task.nextRun?.toISOString()})`)
      }
    }
    
    console.log(`Task scheduler started with ${this.tasks.size} tasks`)
  }

  async stop() {
    this.isRunning = false
    console.log('Task scheduler stopped')
  }

  async executeTask(taskId: string): Promise<TaskExecutionResult> {
    const task = this.tasks.get(taskId)
    if (!task) {
      throw new Error(`Task not found: ${taskId}`)
    }
    
    const startTime = Date.now()
    console.log(`Executing task: ${taskId} (${task.adapter.name})`)
    
    const result: TaskExecutionResult = {
      taskId,
      success: false,
      recordCount: 0,
      errors: [],
      warnings: [],
      executionTime: 0,
      timestamp: new Date()
    }
    
    try {
      // 执行数据采集
      const { data, evidence } = await task.adapter.collectData()
      
      // 数据验证
      const validation = await task.adapter.validateData(data)
      if (!validation.isValid) {
        result.errors.push(...validation.errors)
        result.warnings.push(...validation.warnings)
        
        // 如果有严重错误，标记为失败
        if (validation.errors.length > 0) {
          throw new Error(`Data validation failed: ${validation.errors.join(', ')}`)
        }
      }
      
      // 提交数据到主数据库
      if (data.length > 0) {
        await this.submitDataToAPI(data, evidence)
        result.recordCount = data.length
      }
      
      result.success = true
      result.warnings.push(...validation.warnings)
      task.retryCount = 0 // 重置重试计数
      task.lastRun = new Date()
      
      console.log(`Task ${taskId} completed: ${result.recordCount} records collected`)
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      result.errors.push(errorMessage)
      task.retryCount++
      
      console.error(`Task ${taskId} failed (attempt ${task.retryCount}/${task.maxRetries}):`, errorMessage)
      
      // 如果重试次数未超限，安排重试
      if (task.retryCount < task.maxRetries) {
        setTimeout(() => {
          console.log(`Retrying task ${taskId} in ${task.retryCount * 5} minutes`)
          this.executeTask(taskId)
        }, task.retryCount * 5 * 60 * 1000) // 递增延迟重试
      } else {
        console.error(`Task ${taskId} failed after ${task.maxRetries} attempts`)
        // 发送告警通知
        await this.sendAlert(taskId, errorMessage)
      }
    }
    
    result.executionTime = Date.now() - startTime
    this.executionHistory.push(result)
    
    // 保持执行历史在合理范围内
    if (this.executionHistory.length > 1000) {
      this.executionHistory = this.executionHistory.slice(-500)
    }
    
    return result
  }

  private async submitDataToAPI(records: PriceRecord[], evidence: any[]) {
    try {
      // 准备CSV格式数据
      const csvData = this.convertToCSVFormat(records)
      
      // 提交到主应用的导入API
      const formData = new FormData()
      const csvBlob = new Blob([csvData], { type: 'text/csv' })
      formData.append('file', csvBlob, 'mcp-collected-data.csv')
      formData.append('source', 'MCP Automation')
      
      const response = await fetch('http://localhost:3000/api/import', {
        method: 'POST',
        body: formData
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(`Import API failed: ${response.status} - ${errorData.error || 'Unknown error'}`)
      }
      
      const importResult = await response.json()
      console.log(`Data submitted successfully: ${importResult.imported || 0} records imported`)
      
    } catch (error) {
      console.error('Failed to submit data to API:', error)
      throw error
    }
  }

  private convertToCSVFormat(records: PriceRecord[]): string {
    if (records.length === 0) return ''
    
    // CSV标题行
    const headers = [
      'market_code',
      'instrument_code', 
      'date',
      'price',
      'price_type',
      'currency',
      'unit',
      'volume',
      'source_url',
      'notes'
    ]
    
    // 数据行
    const rows = records.map(record => [
      record.marketCode,
      record.instrumentCode,
      record.date,
      record.price.toString(),
      'close',
      record.currency,
      'tCO2e',
      record.volume?.toString() || '',
      record.sourceUrl || '',
      `MCP采集: ${record.collectedBy}`
    ])
    
    // 组合CSV内容
    const csvContent = [headers, ...rows]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n')
    
    return csvContent
  }

  private calculateNextRun(schedule: string): Date {
    // 简化的cron计算，实际应使用cron库
    const now = new Date()
    const nextRun = new Date(now.getTime() + 24 * 60 * 60 * 1000) // 暂时设为24小时后
    return nextRun
  }

  private async sendAlert(taskId: string, error: string) {
    try {
      // 发送到监控系统或通知服务
      console.error(`ALERT: Task ${taskId} failed permanently: ${error}`)
      
      // 如果配置了外部监控，可以在这里发送通知
      // 例如：Sentry, Slack, 邮件等
      
    } catch (alertError) {
      console.error('Failed to send alert:', alertError)
    }
  }

  // 管理接口方法
  getTasks(): ScheduledTask[] {
    return Array.from(this.tasks.values())
  }

  getTaskStatus(taskId: string): ScheduledTask | null {
    return this.tasks.get(taskId) || null
  }

  enableTask(taskId: string): boolean {
    const task = this.tasks.get(taskId)
    if (task) {
      task.enabled = true
      return true
    }
    return false
  }

  disableTask(taskId: string): boolean {
    const task = this.tasks.get(taskId)
    if (task) {
      task.enabled = false
      return true
    }
    return false
  }

  getExecutionHistory(taskId?: string): TaskExecutionResult[] {
    if (taskId) {
      return this.executionHistory.filter(h => h.taskId === taskId)
    }
    return this.executionHistory
  }

  async getHealthStatus(): Promise<{
    scheduler: 'healthy' | 'degraded' | 'unhealthy'
    tasks: Record<string, { status: string; message: string }>
  }> {
    const taskHealth: Record<string, { status: string; message: string }> = {}
    
    // 检查各个适配器健康状态
    for (const [taskId, task] of this.tasks) {
      try {
        const health = await task.adapter.getHealthStatus()
        taskHealth[taskId] = health
      } catch (error) {
        taskHealth[taskId] = {
          status: 'unhealthy',
          message: `Health check failed: ${error instanceof Error ? error.message : String(error)}`
        }
      }
    }
    
    // 评估调度器总体健康状态
    const healthyTasks = Object.values(taskHealth).filter(h => h.status === 'healthy').length
    const totalTasks = this.tasks.size
    
    let schedulerStatus: 'healthy' | 'degraded' | 'unhealthy'
    if (healthyTasks === totalTasks) {
      schedulerStatus = 'healthy'
    } else if (healthyTasks >= totalTasks * 0.5) {
      schedulerStatus = 'degraded'
    } else {
      schedulerStatus = 'unhealthy'
    }
    
    return {
      scheduler: schedulerStatus,
      tasks: taskHealth
    }
  }

  async executeAllTasks(): Promise<TaskExecutionResult[]> {
    const results: TaskExecutionResult[] = []
    
    console.log('Executing all enabled tasks...')
    
    for (const [taskId, task] of this.tasks) {
      if (task.enabled) {
        try {
          const result = await this.executeTask(taskId)
          results.push(result)
        } catch (error) {
          console.error(`Failed to execute task ${taskId}:`, error)
          results.push({
            taskId,
            success: false,
            recordCount: 0,
            errors: [error instanceof Error ? error.message : String(error)],
            warnings: [],
            executionTime: 0,
            timestamp: new Date()
          })
        }
      }
    }
    
    return results
  }
}