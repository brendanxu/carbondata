import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { PriceQuerySchema } from '@/lib/validators/price-data'
import Papa from 'papaparse'

// GET /api/prices/export - 导出价格数据为CSV
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const format = searchParams.get('format') || 'csv'
    
    const queryParams = {
      marketCode: searchParams.get('marketCode') || undefined,
      instrumentCode: searchParams.get('instrumentCode') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      qaStatus: searchParams.get('qaStatus') || undefined,
      page: '1',
      pageSize: '10000', // 导出时获取更多数据
      sortBy: searchParams.get('sortBy') || 'date',
      sortOrder: searchParams.get('sortOrder') || 'desc'
    }

    const validatedQuery = PriceQuerySchema.parse(queryParams)
    
    // 构建查询条件（复用逻辑）
    const where: any = {}
    
    if (validatedQuery.marketCode) {
      const market = await prisma.market.findUnique({
        where: { code: validatedQuery.marketCode }
      })
      if (market) {
        const instruments = await prisma.instrument.findMany({
          where: { marketId: market.id }
        })
        where.instrumentId = { in: instruments.map(i => i.id) }
      }
    }
    
    if (validatedQuery.instrumentCode) {
      const instrument = await prisma.instrument.findFirst({
        where: { code: validatedQuery.instrumentCode }
      })
      if (instrument) {
        where.instrumentId = instrument.id
      }
    }
    
    if (validatedQuery.startDate || validatedQuery.endDate) {
      where.date = {}
      if (validatedQuery.startDate) {
        where.date.gte = new Date(validatedQuery.startDate)
      }
      if (validatedQuery.endDate) {
        where.date.lte = new Date(validatedQuery.endDate)
      }
    }
    
    if (validatedQuery.qaStatus) {
      where.qaStatus = validatedQuery.qaStatus
    }
    
    // 查询数据
    const prices = await prisma.dailyPrice.findMany({
      where,
      include: {
        instrument: {
          include: {
            market: true
          }
        },
        venue: true
      },
      orderBy: {
        [validatedQuery.sortBy]: validatedQuery.sortOrder
      },
      take: validatedQuery.pageSize
    })
    
    // 格式化数据
    const exportData = prices.map(price => ({
      date: price.date.toISOString().split('T')[0],
      market_code: price.instrument.market.code,
      market_name: price.instrument.market.name,
      instrument_code: price.instrument.code,
      instrument_name: price.instrument.name,
      price: Number(price.price),
      price_type: price.priceType,
      currency: price.currency,
      unit: price.unit,
      volume: price.volume ? Number(price.volume) : '',
      venue_name: price.venue?.name || '',
      source_url: price.sourceUrl || '',
      qa_status: price.qaStatus,
      collected_at: price.collectedAt.toISOString(),
      collected_by: price.collectedBy || '',
      notes: price.notes || ''
    }))
    
    if (format === 'json') {
      return NextResponse.json({
        success: true,
        data: exportData,
        count: exportData.length
      })
    }
    
    // 导出为CSV
    const csv = Papa.unparse(exportData, {
      header: true,
      skipEmptyLines: true
    })
    
    const filename = `carbon-prices-${new Date().toISOString().split('T')[0]}.csv`
    
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    })
  } catch (error) {
    console.error('Error exporting prices:', error)
    return NextResponse.json(
      { success: false, error: 'Export failed' },
      { status: 500 }
    )
  }
}