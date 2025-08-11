import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { PriceQuerySchema } from '@/lib/validators/price-data'
import { z } from 'zod'

// GET /api/prices - 查询价格数据
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const queryParams = {
      marketCode: searchParams.get('marketCode') || undefined,
      instrumentCode: searchParams.get('instrumentCode') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      qaStatus: searchParams.get('qaStatus') || undefined,
      page: searchParams.get('page') || '1',
      pageSize: searchParams.get('pageSize') || '100',
      sortBy: searchParams.get('sortBy') || 'date',
      sortOrder: searchParams.get('sortOrder') || 'desc'
    }

    // 验证查询参数
    const validatedQuery = PriceQuerySchema.parse(queryParams)
    
    // 构建查询条件
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
    
    // 计算分页
    const skip = (validatedQuery.page - 1) * validatedQuery.pageSize
    const take = validatedQuery.pageSize
    
    // 查询数据
    const [prices, total] = await Promise.all([
      prisma.dailyPrice.findMany({
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
        skip,
        take
      }),
      prisma.dailyPrice.count({ where })
    ])
    
    // 格式化响应
    const formattedPrices = prices.map(price => ({
      id: price.id,
      date: price.date.toISOString().split('T')[0],
      marketCode: price.instrument.market.code,
      marketName: price.instrument.market.name,
      instrumentCode: price.instrument.code,
      instrumentName: price.instrument.name,
      price: Number(price.price),
      priceType: price.priceType,
      currency: price.currency,
      unit: price.unit,
      volume: price.volume ? Number(price.volume) : null,
      venueName: price.venue?.name || null,
      sourceUrl: price.sourceUrl,
      qaStatus: price.qaStatus,
      collectedAt: price.collectedAt.toISOString(),
      collectedBy: price.collectedBy,
      notes: price.notes
    }))
    
    return NextResponse.json({
      success: true,
      data: formattedPrices,
      pagination: {
        page: validatedQuery.page,
        pageSize: validatedQuery.pageSize,
        total,
        totalPages: Math.ceil(total / validatedQuery.pageSize)
      }
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid query parameters', details: error.errors },
        { status: 400 }
      )
    }
    
    console.error('Error fetching prices:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}