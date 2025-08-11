#!/usr/bin/env node

import { TaskScheduler } from './scheduler/task-scheduler'
import { CEAAdapter } from './adapters/cea-cneeex'
import { CCEROfficialAdapter } from './adapters/ccer-official'
import { CarbCSVAdapter } from './adapters/carb-csv'
import { CDRfyiAdapter } from './adapters/cdr-fyi'

const scheduler = new TaskScheduler()

async function main() {
  const command = process.argv[2]
  
  switch (command) {
    case 'start':
      console.log('Starting MCP task scheduler...')
      await scheduler.start()
      break
      
    case 'stop':
      console.log('Stopping MCP task scheduler...')
      await scheduler.stop()
      break
      
    case 'status':
      const health = await scheduler.getHealthStatus()
      console.log('Scheduler Status:', health.scheduler)
      console.log('Task Status:')
      for (const [taskId, status] of Object.entries(health.tasks)) {
        console.log(`  ${taskId}: ${status.status} - ${status.message}`)
      }
      break
      
    case 'run':
      const taskId = process.argv[3]
      if (taskId) {
        console.log(`Running task: ${taskId}`)
        const result = await scheduler.executeTask(taskId)
        console.log('Result:', result)
      } else {
        console.log('Running all tasks...')
        const results = await scheduler.executeAllTasks()
        console.log(`Executed ${results.length} tasks`)
        results.forEach(r => {
          console.log(`${r.taskId}: ${r.success ? 'SUCCESS' : 'FAILED'} - ${r.recordCount} records`)
        })
      }
      break
      
    case 'history':
      const history = scheduler.getExecutionHistory()
      console.log(`Execution History (${history.length} entries):`)
      history.slice(-10).forEach(h => {
        console.log(`${h.timestamp.toISOString()} - ${h.taskId}: ${h.success ? 'SUCCESS' : 'FAILED'} (${h.recordCount} records)`)
      })
      break
      
    case 'test-adapter':
      const adapterName = process.argv[3]
      await testAdapter(adapterName)
      break
      
    default:
      console.log(`
MCP Carbon Data Collector

Commands:
  start           Start the task scheduler
  stop            Stop the task scheduler  
  status          Show scheduler and task health status
  run [taskId]    Run specific task or all tasks
  history         Show execution history
  test-adapter <name>  Test specific adapter
  
Examples:
  npm run mcp start
  npm run mcp run cea-daily
  npm run mcp status
`)
  }
}

async function testAdapter(adapterName?: string) {
  const adapters: Record<string, () => any> = {
    'cea': () => new CEAAdapter(),
    'ccer': () => new CCEROfficialAdapter(),
    'carb': () => new CarbCSVAdapter(),
    'cdr': () => new CDRfyiAdapter()
  }
  
  if (!adapterName || !adapters[adapterName]) {
    console.log('Available adapters:', Object.keys(adapters).join(', '))
    return
  }
  
  console.log(`Testing ${adapterName} adapter...`)
  
  try {
    const adapter = adapters[adapterName]()
    const startTime = Date.now()
    
    // 测试健康检查
    const health = await adapter.getHealthStatus()
    console.log('Health Status:', health)
    
    // 测试数据采集
    const { data, evidence } = await adapter.collectData()
    console.log(`Collected ${data.length} records with ${evidence.length} evidence items`)
    
    // 测试数据验证
    if (data.length > 0) {
      const validation = await adapter.validateData(data)
      console.log('Validation Result:')
      console.log(`  Valid: ${validation.isValid}`)
      console.log(`  Quality Score: ${validation.qualityScore}`)
      console.log(`  Errors: ${validation.errors.length}`)
      console.log(`  Warnings: ${validation.warnings.length}`)
      
      if (validation.errors.length > 0) {
        console.log('Errors:', validation.errors)
      }
      if (validation.warnings.length > 0) {
        console.log('Warnings:', validation.warnings)
      }
    }
    
    const executionTime = Date.now() - startTime
    console.log(`Test completed in ${executionTime}ms`)
    
  } catch (error) {
    console.error('Adapter test failed:', error)
  }
}

// 优雅关闭处理
process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down gracefully...')
  await scheduler.stop()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully...')
  await scheduler.stop()
  process.exit(0)
})

if (require.main === module) {
  main().catch(error => {
    console.error('MCP scheduler error:', error)
    process.exit(1)
  })
}