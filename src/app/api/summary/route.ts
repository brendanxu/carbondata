import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

// GET /api/summary - 获取市场汇总数据
export async function GET(request: NextRequest) {
  try {
    // 获取所有市场
    const markets = await prisma.market.findMany({
      include: {
        instruments: true
      }
    })
    
    // 获取每个市场的最新数据
    const summaryData = await Promise.all(
      markets.map(async (market) => {
        const instrumentIds = market.instruments.map(i => i.id)
        
        if (instrumentIds.length === 0) {
          return {
            marketCode: market.code,
            marketName: market.name,
            region: market.region,
            instruments: [],
            lastUpdate: null
          }
        }
        
        // 获取每个工具的最新价格和衍生指标
        const instrumentData = await Promise.all(
          market.instruments.map(async (instrument) => {
            // 获取最新价格
            const latestPrice = await prisma.dailyPrice.findFirst({
              where: {
                instrumentId: instrument.id,
                qaStatus: 'APPROVED'
              },
              orderBy: { date: 'desc' },
              include: { venue: true }
            })
            
            if (!latestPrice) {
              return null
            }
            
            // 获取前一天价格（计算DoD）
            const previousPrice = await prisma.dailyPrice.findFirst({
              where: {
                instrumentId: instrument.id,
                qaStatus: 'APPROVED',
                date: {
                  lt: latestPrice.date
                }
              },
              orderBy: { date: 'desc' }
            })
            
            // 获取7天前价格（计算WoW）
            const weekAgoDate = new Date(latestPrice.date)
            weekAgoDate.setDate(weekAgoDate.getDate() - 7)
            const weekAgoPrice = await prisma.dailyPrice.findFirst({
              where: {
                instrumentId: instrument.id,
                qaStatus: 'APPROVED',
                date: {
                  gte: weekAgoDate,
                  lt: latestPrice.date
                }
              },
              orderBy: { date: 'asc' }
            })
            
            // 计算7日和30日均线
            const thirtyDaysAgo = new Date(latestPrice.date)
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
            
            const historicalPrices = await prisma.dailyPrice.findMany({
              where: {
                instrumentId: instrument.id,
                qaStatus: 'APPROVED',
                date: {
                  gte: thirtyDaysAgo,
                  lte: latestPrice.date
                }
              },
              orderBy: { date: 'desc' }
            })
            
            // 计算均线
            const prices7d = historicalPrices.slice(0, 7)
            const ma7 = prices7d.length > 0 
              ? prices7d.reduce((sum, p) => sum + Number(p.price), 0) / prices7d.length 
              : null
            
            const ma30 = historicalPrices.length > 0
              ? historicalPrices.reduce((sum, p) => sum + Number(p.price), 0) / historicalPrices.length
              : null
            
            // 计算变化率
            const dod = previousPrice 
              ? ((Number(latestPrice.price) - Number(previousPrice.price)) / Number(previousPrice.price)) * 100
              : null
            
            const wow = weekAgoPrice
              ? ((Number(latestPrice.price) - Number(weekAgoPrice.price)) / Number(weekAgoPrice.price)) * 100
              : null
            
            // 获取最近7天的成交量总和
            const sevenDaysVolume = await prisma.dailyPrice.aggregate({
              where: {
                instrumentId: instrument.id,
                date: {
                  gte: new Date(latestPrice.date.getTime() - 7 * 24 * 60 * 60 * 1000),
                  lte: latestPrice.date
                }
              },
              _sum: {
                volume: true
              }
            })
            
            return {
              instrumentCode: instrument.code,
              instrumentName: instrument.name,
              currency: instrument.currency,
              unit: instrument.unit,
              latestPrice: {
                date: latestPrice.date.toISOString().split('T')[0],
                price: Number(latestPrice.price),
                priceType: latestPrice.priceType,
                volume: latestPrice.volume ? Number(latestPrice.volume) : null,
                venue: latestPrice.venue?.name || null
              },
              changes: {
                dod: dod ? Number(dod.toFixed(2)) : null,
                wow: wow ? Number(wow.toFixed(2)) : null
              },
              movingAverages: {
                ma7: ma7 ? Number(ma7.toFixed(2)) : null,
                ma30: ma30 ? Number(ma30.toFixed(2)) : null
              },
              volume7d: sevenDaysVolume._sum.volume ? Number(sevenDaysVolume._sum.volume) : null,
              lastUpdate: latestPrice.collectedAt.toISOString()
            }
          })
        )
        
        // 过滤掉null值
        const validInstruments = instrumentData.filter(i => i !== null)
        
        return {
          marketCode: market.code,
          marketName: market.name,
          region: market.region,
          instruments: validInstruments,
          lastUpdate: validInstruments.length > 0 
            ? validInstruments[0].lastUpdate 
            : null
        }
      })
    )
    
    // 计算一些全局统计
    const totalInstruments = summaryData.reduce((sum, m) => sum + m.instruments.length, 0)
    const marketsWithData = summaryData.filter(m => m.instruments.length > 0).length
    
    return NextResponse.json({
      success: true,
      data: {
        markets: summaryData,
        statistics: {
          totalMarkets: markets.length,
          marketsWithData,
          totalInstruments,
          lastUpdate: new Date().toISOString()
        }
      }
    })
  } catch (error) {
    console.error('Error fetching summary:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch summary data' },
      { status: 500 }
    )
  }
}