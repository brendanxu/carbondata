import Papa from 'papaparse'
import { z } from 'zod'
import { 
  CSVRowSchema, 
  type CSVRow, 
  performQualityChecks,
  type QualityCheckResult 
} from '@/lib/validators/price-data'

export interface ParseResult {
  success: boolean
  data: CSVRow[]
  errors: ParseError[]
  warnings: string[]
  totalRows: number
  validRows: number
  invalidRows: number
}

export interface ParseError {
  row: number
  field?: string
  message: string
  data?: any
}

export class CSVParser {
  private errors: ParseError[] = []
  private warnings: string[] = []
  private validData: CSVRow[] = []
  
  /**
   * 解析CSV文件内容
   */
  async parseCSV(fileContent: string): Promise<ParseResult> {
    return new Promise((resolve) => {
      Papa.parse(fileContent, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim().toLowerCase().replace(/\s+/g, '_'),
        complete: (results) => {
          this.processResults(results)
          resolve(this.getParseResult(results.data.length))
        },
        error: (error) => {
          this.errors.push({
            row: 0,
            message: `CSV Parse Error: ${error.message}`
          })
          resolve(this.getParseResult(0))
        }
      })
    })
  }
  
  /**
   * 解析CSV文件
   */
  async parseFile(file: File): Promise<ParseResult> {
    const content = await file.text()
    return this.parseCSV(content)
  }
  
  /**
   * 处理解析结果
   */
  private processResults(results: Papa.ParseResult<any>) {
    const previousPrices: Map<string, number> = new Map()
    
    results.data.forEach((row, index) => {
      const rowNumber = index + 2 // 考虑表头，行号从2开始
      
      try {
        // 数据验证
        const validatedRow = CSVRowSchema.parse(row)
        
        // 质量检查
        const instrumentKey = `${validatedRow.market_code}-${validatedRow.instrument_code}`
        const previousPrice = previousPrices.get(instrumentKey)
        const qualityCheck = performQualityChecks(validatedRow, previousPrice)
        
        if (!qualityCheck.isValid) {
          qualityCheck.errors.forEach(error => {
            this.errors.push({
              row: rowNumber,
              message: error,
              data: row
            })
          })
        } else {
          // 数据有效，添加到结果中
          this.validData.push(validatedRow)
          previousPrices.set(instrumentKey, validatedRow.price)
          
          // 添加警告
          qualityCheck.warnings.forEach(warning => {
            this.warnings.push(`Row ${rowNumber}: ${warning}`)
          })
        }
      } catch (error) {
        if (error instanceof z.ZodError) {
          error.errors.forEach(zodError => {
            this.errors.push({
              row: rowNumber,
              field: zodError.path.join('.'),
              message: zodError.message,
              data: row
            })
          })
        } else {
          this.errors.push({
            row: rowNumber,
            message: error instanceof Error ? error.message : 'Unknown error',
            data: row
          })
        }
      }
    })
    
    // 检查数据完整性
    this.checkDataCompleteness()
  }
  
  /**
   * 检查数据完整性
   */
  private checkDataCompleteness() {
    // 检查是否有重复的日期-工具组合
    const uniqueKeys = new Set<string>()
    const duplicates: string[] = []
    
    this.validData.forEach((row, index) => {
      const key = `${row.instrument_code}-${row.date}`
      if (uniqueKeys.has(key)) {
        duplicates.push(key)
        this.warnings.push(`Duplicate entry found: ${key} at row ${index + 2}`)
      }
      uniqueKeys.add(key)
    })
    
    // 检查日期连续性（可选，根据需求启用）
    // this.checkDateContinuity()
  }
  
  /**
   * 获取解析结果
   */
  private getParseResult(totalRows: number): ParseResult {
    return {
      success: this.errors.length === 0,
      data: this.validData,
      errors: this.errors,
      warnings: this.warnings,
      totalRows,
      validRows: this.validData.length,
      invalidRows: this.errors.filter(e => e.row > 0).length
    }
  }
  
  /**
   * 重置解析器状态
   */
  reset() {
    this.errors = []
    this.warnings = []
    this.validData = []
  }
}

/**
 * 生成CSV模板
 */
export function generateCSVTemplate(): string {
  const headers = [
    'market_code',
    'market_name',
    'instrument_code',
    'instrument_name',
    'date',
    'price',
    'price_type',
    'currency',
    'unit',
    'volume',
    'venue_name',
    'source_url',
    'collected_at',
    'collected_by',
    'qa_status',
    'evidence_file',
    'notes'
  ]
  
  const sampleRows = [
    ['EU', 'EU ETS', 'EUA', 'EU Allowance', '2024-01-15', '65.50', 'CLOSE', 'EUR', 'tCO2e', '125000', 'ICE Endex', 'https://example.com', '', 'system', 'PENDING', '', ''],
    ['UK', 'UK ETS', 'UKA', 'UK Allowance', '2024-01-15', '35.20', 'CLOSE', 'GBP', 'tCO2e', '85000', 'ICE Endex', 'https://example.com', '', 'system', 'PENDING', '', ''],
    ['CEA', '中国全国碳市场', 'CEA', '全国碳配额', '2024-01-15', '85.60', 'CLOSE', 'CNY', 'tCO2e', '450000', '上海环境能源交易所', 'http://www.cneeex.com', '', 'system', 'PENDING', '', '']
  ]
  
  const csvContent = [
    headers.join(','),
    ...sampleRows.map(row => row.join(','))
  ].join('\n')
  
  return csvContent
}

/**
 * 导出数据为CSV
 */
export function exportToCSV(data: any[], filename: string = 'carbon-data-export.csv') {
  const csv = Papa.unparse(data, {
    header: true,
    skipEmptyLines: true
  })
  
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  
  URL.revokeObjectURL(url)
}