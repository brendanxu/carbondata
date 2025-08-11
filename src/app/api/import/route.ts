import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { CSVParser } from '@/lib/csv/parser'
import { ImportStatus, PriceType, QAStatus } from '@prisma/client'

// POST /api/import - 批量导入价格数据
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const importedBy = formData.get('importedBy') as string || 'system'
    
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      )
    }
    
    // 创建导入批次记录
    const importBatch = await prisma.importBatch.create({
      data: {
        fileName: file.name,
        fileType: 'CSV',
        status: ImportStatus.PROCESSING,
        importedBy,
        startedAt: new Date()
      }
    })
    
    try {
      // 解析CSV文件
      const parser = new CSVParser()
      const fileContent = await file.text()
      const parseResult = await parser.parseCSV(fileContent)
      
      if (!parseResult.success && parseResult.errors.length > 0) {
        // 更新导入批次状态
        await prisma.importBatch.update({
          where: { id: importBatch.id },
          data: {
            status: ImportStatus.FAILED,
            totalRows: parseResult.totalRows,
            failedRows: parseResult.invalidRows,
            errors: parseResult.errors,
            completedAt: new Date()
          }
        })
        
        return NextResponse.json(
          { 
            success: false, 
            error: 'CSV parsing failed',
            details: parseResult.errors,
            warnings: parseResult.warnings
          },
          { status: 400 }
        )
      }
      
      // 开始数据导入事务
      const importResults = await prisma.$transaction(async (tx) => {
        const results = {
          created: 0,
          updated: 0,
          failed: 0,
          errors: [] as any[]
        }
        
        // 预加载所有市场和工具数据
        const markets = await tx.market.findMany()
        const marketMap = new Map(markets.map(m => [m.code, m]))
        
        const instruments = await tx.instrument.findMany()
        const instrumentMap = new Map(instruments.map(i => [`${i.code}`, i]))
        
        const venues = await tx.venue.findMany()
        const venueMap = new Map(venues.map(v => [v.name, v]))
        
        // 处理每一行数据
        for (const row of parseResult.data) {
          try {
            // 查找或创建市场
            let market = marketMap.get(row.market_code)
            if (!market && row.market_name) {
              market = await tx.market.create({
                data: {
                  code: row.market_code,
                  name: row.market_name,
                  region: 'Unknown' // 需要根据市场代码推断
                }
              })
              marketMap.set(row.market_code, market)
            }
            
            if (!market) {
              results.errors.push({
                row,
                error: `Market not found: ${row.market_code}`
              })
              results.failed++
              continue
            }
            
            // 查找或创建工具
            let instrument = instrumentMap.get(row.instrument_code)
            if (!instrument && row.instrument_name) {
              instrument = await tx.instrument.create({
                data: {
                  marketId: market.id,
                  code: row.instrument_code,
                  name: row.instrument_name || row.instrument_code,
                  currency: row.currency,
                  unit: row.unit || 'tCO2e'
                }
              })
              instrumentMap.set(row.instrument_code, instrument)
            }
            
            if (!instrument) {
              // 尝试通过market和code查找
              instrument = await tx.instrument.findFirst({
                where: {
                  marketId: market.id,
                  code: row.instrument_code
                }
              })
              
              if (!instrument) {
                results.errors.push({
                  row,
                  error: `Instrument not found: ${row.instrument_code}`
                })
                results.failed++
                continue
              }
            }
            
            // 查找或创建场所
            let venueId: string | null = null
            if (row.venue_name) {
              let venue = venueMap.get(row.venue_name)
              if (!venue) {
                venue = await tx.venue.create({
                  data: {
                    name: row.venue_name,
                    code: row.venue_name.replace(/\s+/g, '_').toUpperCase(),
                    url: row.source_url
                  }
                })
                venueMap.set(row.venue_name, venue)
              }
              venueId = venue.id
            }
            
            // 创建或更新价格数据
            const priceDate = new Date(row.date)
            const existingPrice = await tx.dailyPrice.findUnique({
              where: {
                instrumentId_date: {
                  instrumentId: instrument.id,
                  date: priceDate
                }
              }
            })
            
            const priceData = {
              instrumentId: instrument.id,
              date: priceDate,
              price: row.price,
              priceType: (row.price_type || 'CLOSE') as PriceType,
              currency: row.currency,
              unit: row.unit || 'tCO2e',
              volume: row.volume || null,
              venueId,
              sourceUrl: row.source_url,
              collectedBy: row.collected_by || importedBy,
              qaStatus: (row.qa_status || 'PENDING') as QAStatus,
              notes: row.notes
            }
            
            if (existingPrice) {
              await tx.dailyPrice.update({
                where: { id: existingPrice.id },
                data: priceData
              })
              results.updated++
              
              // 记录更新审计日志
              await tx.auditLog.create({
                data: {
                  entity: 'DailyPrice',
                  entityId: existingPrice.id,
                  action: 'UPDATE',
                  actor: importedBy,
                  diff: { old: existingPrice, new: priceData }
                }
              })
            } else {
              const newPrice = await tx.dailyPrice.create({
                data: priceData
              })
              results.created++
              
              // 记录创建审计日志
              await tx.auditLog.create({
                data: {
                  entity: 'DailyPrice',
                  entityId: newPrice.id,
                  action: 'CREATE',
                  actor: importedBy,
                  metadata: { importBatchId: importBatch.id }
                }
              })
            }
          } catch (error) {
            results.errors.push({
              row,
              error: error instanceof Error ? error.message : 'Unknown error'
            })
            results.failed++
          }
        }
        
        return results
      })
      
      // 更新导入批次状态
      const finalStatus = importResults.failed === 0 
        ? ImportStatus.SUCCESS 
        : importResults.created + importResults.updated > 0 
          ? ImportStatus.PARTIAL 
          : ImportStatus.FAILED
      
      await prisma.importBatch.update({
        where: { id: importBatch.id },
        data: {
          status: finalStatus,
          totalRows: parseResult.totalRows,
          successRows: importResults.created + importResults.updated,
          failedRows: importResults.failed,
          errors: importResults.errors.length > 0 ? importResults.errors : null,
          completedAt: new Date()
        }
      })
      
      // 触发衍生指标计算（可以异步执行）
      // TODO: 实现衍生指标计算逻辑
      
      return NextResponse.json({
        success: true,
        message: 'Import completed',
        batchId: importBatch.id,
        results: {
          created: importResults.created,
          updated: importResults.updated,
          failed: importResults.failed,
          total: parseResult.totalRows
        },
        warnings: parseResult.warnings,
        errors: importResults.errors
      })
      
    } catch (error) {
      // 更新导入批次为失败状态
      await prisma.importBatch.update({
        where: { id: importBatch.id },
        data: {
          status: ImportStatus.FAILED,
          errors: [{ message: error instanceof Error ? error.message : 'Unknown error' }],
          completedAt: new Date()
        }
      })
      
      throw error
    }
    
  } catch (error) {
    console.error('Import error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Import failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}