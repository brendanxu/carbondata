import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { dataMissingAlert } from '@/lib/monitoring/alerts'

// GET /api/monitoring/data-freshness - 检查数据新鲜度
export async function GET() {
  try {
    const markets = await prisma.market.findMany({
      include: {
        instruments: true
      }
    })
    
    const freshnessReport = await Promise.all(
      markets.map(async (market) => {
        const instrumentIds = market.instruments.map(i => i.id)
        
        if (instrumentIds.length === 0) {
          return {
            marketCode: market.code,
            marketName: market.name,
            status: 'no_instruments',
            lastUpdate: null,
            daysSinceUpdate: null
          }
        }
        
        // 获取该市场最新的数据
        const latestPrice = await prisma.dailyPrice.findFirst({
          where: {
            instrumentId: { in: instrumentIds }
          },
          orderBy: {
            date: 'desc'
          }
        })
        
        if (!latestPrice) {
          return {
            marketCode: market.code,
            marketName: market.name,
            status: 'no_data',
            lastUpdate: null,
            daysSinceUpdate: null
          }
        }
        
        const daysSinceUpdate = Math.floor(
          (Date.now() - latestPrice.date.getTime()) / (1000 * 60 * 60 * 24)
        )
        
        let status = 'healthy'
        if (daysSinceUpdate > 3) {
          status = 'stale'
          // 发送告警
          await dataMissingAlert(market.code, latestPrice.date)
        } else if (daysSinceUpdate > 1) {
          status = 'warning'
        }
        
        return {
          marketCode: market.code,
          marketName: market.name,
          status,
          lastUpdate: latestPrice.date.toISOString().split('T')[0],
          daysSinceUpdate,
          collectedAt: latestPrice.collectedAt.toISOString()
        }
      })
    )
    
    // 计算整体状态
    const hasStale = freshnessReport.some(r => r.status === 'stale')
    const hasWarning = freshnessReport.some(r => r.status === 'warning')
    const hasNoData = freshnessReport.some(r => r.status === 'no_data')
    
    let overallStatus = 'healthy'
    if (hasNoData || hasStale) {
      overallStatus = 'unhealthy'
    } else if (hasWarning) {
      overallStatus = 'warning'
    }
    
    return NextResponse.json({
      success: true,
      data: {
        overallStatus,
        checkTime: new Date().toISOString(),
        markets: freshnessReport,
        summary: {
          totalMarkets: markets.length,
          healthyMarkets: freshnessReport.filter(r => r.status === 'healthy').length,
          warningMarkets: freshnessReport.filter(r => r.status === 'warning').length,
          staleMarkets: freshnessReport.filter(r => r.status === 'stale').length,
          noDataMarkets: freshnessReport.filter(r => r.status === 'no_data').length
        }
      }
    })
  } catch (error) {
    console.error('Data freshness check failed:', error)
    return NextResponse.json({
      success: false,
      error: 'Health check failed',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}