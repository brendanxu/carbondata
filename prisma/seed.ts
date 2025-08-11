import { PrismaClient, PriceType, QAStatus } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'

const prisma = new PrismaClient()

async function main() {
  // 清理现有数据
  await prisma.auditLog.deleteMany()
  await prisma.derivedMetric.deleteMany()
  await prisma.dailyPrice.deleteMany()
  await prisma.attachment.deleteMany()
  await prisma.instrument.deleteMany()
  await prisma.venue.deleteMany()
  await prisma.market.deleteMany()

  // 创建市场
  const markets = await Promise.all([
    prisma.market.create({
      data: {
        code: 'EU',
        name: 'EU ETS',
        region: 'Europe',
        description: 'European Union Emissions Trading System'
      }
    }),
    prisma.market.create({
      data: {
        code: 'UK',
        name: 'UK ETS',
        region: 'United Kingdom',
        description: 'UK Emissions Trading System'
      }
    }),
    prisma.market.create({
      data: {
        code: 'CCA',
        name: 'California Cap-and-Trade',
        region: 'North America',
        description: 'California Carbon Allowances'
      }
    }),
    prisma.market.create({
      data: {
        code: 'CEA',
        name: 'China National ETS',
        region: 'Asia',
        description: '中国全国碳市场配额'
      }
    }),
    prisma.market.create({
      data: {
        code: 'CCER',
        name: 'China CCER',
        region: 'Asia',
        description: '中国核证自愿减排量'
      }
    }),
    prisma.market.create({
      data: {
        code: 'CDR',
        name: 'Carbon Removal',
        region: 'Global',
        description: 'Carbon Dioxide Removal Credits'
      }
    })
  ])

  // 创建交易场所
  const venues = await Promise.all([
    prisma.venue.create({
      data: {
        code: 'ICE',
        name: 'ICE Endex',
        url: 'https://www.theice.com',
        country: 'Netherlands'
      }
    }),
    prisma.venue.create({
      data: {
        code: 'EEX',
        name: 'European Energy Exchange',
        url: 'https://www.eex.com',
        country: 'Germany'
      }
    }),
    prisma.venue.create({
      data: {
        code: 'SHEX',
        name: '上海环境能源交易所',
        url: 'http://www.cneeex.com',
        country: 'China'
      }
    }),
    prisma.venue.create({
      data: {
        code: 'BJEX',
        name: '北京绿色交易所',
        url: 'https://www.cbeex.com.cn',
        country: 'China'
      }
    })
  ])

  // 创建交易工具
  const instruments = await Promise.all([
    // EU ETS
    prisma.instrument.create({
      data: {
        marketId: markets[0].id,
        code: 'EUA',
        name: 'EU Allowance',
        currency: 'EUR',
        unit: 'tCO2e',
        description: 'European Union Allowance'
      }
    }),
    // UK ETS
    prisma.instrument.create({
      data: {
        marketId: markets[1].id,
        code: 'UKA',
        name: 'UK Allowance',
        currency: 'GBP',
        unit: 'tCO2e',
        description: 'UK Allowance'
      }
    }),
    // California
    prisma.instrument.create({
      data: {
        marketId: markets[2].id,
        code: 'CCA',
        name: 'California Carbon Allowance',
        currency: 'USD',
        unit: 'tCO2e',
        description: 'California Cap-and-Trade Allowance'
      }
    }),
    // China CEA
    prisma.instrument.create({
      data: {
        marketId: markets[3].id,
        code: 'CEA',
        name: '全国碳配额',
        currency: 'CNY',
        unit: 'tCO2e',
        description: '中国全国碳市场配额'
      }
    }),
    // China CCER
    prisma.instrument.create({
      data: {
        marketId: markets[4].id,
        code: 'CCER',
        name: '核证减排量',
        currency: 'CNY',
        unit: 'tCO2e',
        description: '中国核证自愿减排量'
      }
    }),
    // CDR
    prisma.instrument.create({
      data: {
        marketId: markets[5].id,
        code: 'CDR-DAC',
        name: 'Direct Air Capture',
        currency: 'USD',
        unit: 'tCO2e',
        description: 'Direct Air Capture Carbon Removal'
      }
    })
  ])

  // 生成示例价格数据（最近30天）
  const today = new Date()
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
  
  // 基准价格
  const basePrices = {
    'EUA': 65.50,
    'UKA': 35.20,
    'CCA': 32.80,
    'CEA': 85.60,
    'CCER': 45.30,
    'CDR-DAC': 550.00
  }

  for (let i = 0; i < 30; i++) {
    const date = new Date(thirtyDaysAgo.getTime() + i * 24 * 60 * 60 * 1000)
    
    // 生成每个交易工具的价格
    for (const instrument of instruments) {
      const basePrice = basePrices[instrument.code as keyof typeof basePrices]
      // 添加随机波动 (-3% ~ +3%)
      const randomChange = (Math.random() - 0.5) * 0.06
      const price = basePrice * (1 + randomChange)
      const volume = Math.floor(Math.random() * 100000 + 10000)
      
      // 选择对应的交易场所
      let venueId = venues[0].id // 默认ICE
      if (instrument.code === 'CEA' || instrument.code === 'CCER') {
        venueId = Math.random() > 0.5 ? venues[2].id : venues[3].id
      }

      await prisma.dailyPrice.create({
        data: {
          instrumentId: instrument.id,
          date: date,
          price: new Decimal(price.toFixed(2)),
          priceType: PriceType.CLOSE,
          currency: instrument.currency,
          unit: instrument.unit,
          volume: new Decimal(volume),
          venueId: venueId,
          sourceUrl: `https://example.com/data/${instrument.code}/${date.toISOString().split('T')[0]}`,
          collectedBy: 'system',
          qaStatus: i < 25 ? QAStatus.APPROVED : QAStatus.PENDING,
          notes: i === 29 ? '最新数据待审核' : null
        }
      })
    }
  }

  // 计算衍生指标（最近7天）
  for (const instrument of instruments) {
    const prices = await prisma.dailyPrice.findMany({
      where: { instrumentId: instrument.id },
      orderBy: { date: 'desc' },
      take: 30
    })

    for (let i = 0; i < 7; i++) {
      const currentPrice = prices[i]
      if (!currentPrice) continue

      // 计算MA7
      const ma7Prices = prices.slice(i, Math.min(i + 7, prices.length))
      const ma7 = ma7Prices.reduce((sum, p) => sum + Number(p.price), 0) / ma7Prices.length

      // 计算MA30
      const ma30Prices = prices.slice(i, Math.min(i + 30, prices.length))
      const ma30 = ma30Prices.reduce((sum, p) => sum + Number(p.price), 0) / ma30Prices.length

      // 计算DoD
      const prevDayPrice = prices[i + 1]
      const dod = prevDayPrice 
        ? ((Number(currentPrice.price) - Number(prevDayPrice.price)) / Number(prevDayPrice.price)) * 100
        : null

      // 计算WoW
      const weekAgoPrice = prices[i + 7]
      const wow = weekAgoPrice
        ? ((Number(currentPrice.price) - Number(weekAgoPrice.price)) / Number(weekAgoPrice.price)) * 100
        : null

      await prisma.derivedMetric.create({
        data: {
          instrumentId: instrument.id,
          date: currentPrice.date,
          ma7: new Decimal(ma7.toFixed(2)),
          ma30: new Decimal(ma30.toFixed(2)),
          dod: dod ? new Decimal(dod.toFixed(2)) : null,
          wow: wow ? new Decimal(wow.toFixed(2)) : null,
          pctFromMa30: new Decimal(((Number(currentPrice.price) - ma30) / ma30 * 100).toFixed(2))
        }
      })
    }
  }

  // 创建审计日志示例
  await prisma.auditLog.create({
    data: {
      entity: 'DailyPrice',
      entityId: 'batch-import',
      action: 'CREATE',
      actor: 'system',
      metadata: {
        count: 180,
        source: 'seed-script'
      }
    }
  })

  console.log('✅ 种子数据创建成功！')
  console.log(`- ${markets.length} 个市场`)
  console.log(`- ${instruments.length} 个交易工具`)
  console.log(`- ${venues.length} 个交易场所`)
  console.log(`- ${30 * instruments.length} 条价格数据`)
  console.log(`- ${7 * instruments.length} 条衍生指标`)
}

main()
  .catch((e) => {
    console.error('❌ 种子数据创建失败：', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })