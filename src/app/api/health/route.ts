import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

// GET /api/health - 健康检查端点
export async function GET() {
  const startTime = Date.now()
  
  try {
    // 检查数据库连接
    await prisma.$queryRaw`SELECT 1`
    
    // 检查数据完整性
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    
    const todaysData = await prisma.dailyPrice.count({
      where: {
        date: {
          gte: yesterday,
          lte: today
        }
      }
    })
    
    // 检查各市场数据更新状态
    const markets = await prisma.market.findMany()
    const marketStatus = await Promise.all(
      markets.map(async (market) => {
        const latestPrice = await prisma.dailyPrice.findFirst({
          where: {
            instrument: {
              marketId: market.id
            }
          },
          orderBy: {
            date: 'desc'
          }
        })
        
        const daysSinceUpdate = latestPrice 
          ? Math.floor((Date.now() - latestPrice.date.getTime()) / (1000 * 60 * 60 * 24))
          : null
        
        return {
          marketCode: market.code,
          marketName: market.name,
          latestDate: latestPrice?.date?.toISOString().split('T')[0] || null,
          daysSinceUpdate,
          status: daysSinceUpdate === null ? 'no_data' : daysSinceUpdate <= 2 ? 'healthy' : 'stale'
        }
      })
    )
    
    const responseTime = Date.now() - startTime
    
    // 确定整体健康状态
    const hasStaleData = marketStatus.some(m => m.status === 'stale')
    const hasNoData = marketStatus.some(m => m.status === 'no_data')
    
    let overallStatus = 'healthy'
    if (hasNoData) {
      overallStatus = 'degraded'
    } else if (hasStaleData) {
      overallStatus = 'warning'
    }
    
    const healthData = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '0.1.0',
      uptime: process.uptime(),
      responseTime,
      database: {
        status: 'connected',
        recentDataCount: todaysData
      },
      markets: marketStatus,
      environment: process.env.NODE_ENV,
      region: process.env.VERCEL_REGION || 'local'
    }
    
    const statusCode = overallStatus === 'healthy' ? 200 : 
                      overallStatus === 'warning' ? 200 : 
                      503
    
    return NextResponse.json(healthData, { status: statusCode })
  } catch (error) {
    const responseTime = Date.now() - startTime
    
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime,
      database: {
        status: 'disconnected'
      }
    }, { status: 503 })
  }
}