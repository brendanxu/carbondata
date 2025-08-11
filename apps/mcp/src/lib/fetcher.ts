// 通用抓取工具库

import { FetchParams } from '../adapters/types'

/**
 * 带重试的fetch请求
 */
export async function fetchWithRetry(
  url: string, 
  options: FetchParams & RequestInit = {}
): Promise<Response> {
  const { 
    timeout = 10000, 
    retries = 3, 
    headers = {},
    ...fetchOptions 
  } = options

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        ...fetchOptions,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; CarbonDataBot/1.0)',
          ...headers
        },
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      return response
      
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown fetch error')
      
      if (attempt === retries) {
        break
      }
      
      // 指数退避
      const delay = Math.pow(2, attempt) * 1000
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  clearTimeout(timeoutId)
  throw lastError || new Error('All fetch attempts failed')
}

/**
 * 抓取JSON数据
 */
export async function fetchJson<T = any>(
  url: string, 
  options?: FetchParams & RequestInit
): Promise<T> {
  const response = await fetchWithRetry(url, options)
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }
  
  return response.json()
}

/**
 * 抓取CSV数据
 */
export async function fetchCsv(
  url: string, 
  options?: FetchParams & RequestInit
): Promise<string> {
  const response = await fetchWithRetry(url, options)
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }
  
  return response.text()
}

/**
 * 保存页面截图（需要Playwright或类似工具）
 */
export async function saveScreenshot(
  url: string, 
  filename: string,
  options?: {
    selector?: string
    fullPage?: boolean
    width?: number
    height?: number
  }
): Promise<string | null> {
  try {
    // 这里应该集成Playwright或Puppeteer
    // 目前返回占位实现
    console.log(`Screenshot saved: ${filename} for ${url}`)
    
    // 模拟截图文件路径
    const timestamp = Date.now()
    const screenshotPath = `/tmp/screenshots/${timestamp}-${filename}`
    
    // TODO: 实际的截图实现
    // const browser = await playwright.chromium.launch()
    // const page = await browser.newPage()
    // await page.goto(url)
    // await page.screenshot({ path: screenshotPath, fullPage: options?.fullPage })
    // await browser.close()
    
    return screenshotPath
    
  } catch (error) {
    console.error('Screenshot failed:', error)
    return null
  }
}

/**
 * 解析HTML表格
 */
export function parseHTMLTable(
  html: string,
  config: {
    tableSelector: string
    dateColumn: number
    priceColumn: number
    volumeColumn?: number
    skipRows?: number
  }
): Array<{ date: string; price: string; volume?: string }> {
  try {
    // 简单的表格解析实现
    // 在真实环境中，建议使用cheerio或jsdom
    
    const tableMatch = html.match(new RegExp(`<table[^>]*class=[^>]*${config.tableSelector.replace('.', '')}[^>]*>(.*?)</table>`, 'is'))
    if (!tableMatch) {
      return []
    }
    
    const tableContent = tableMatch[1]
    const rowMatches = tableContent.match(/<tr[^>]*>(.*?)<\/tr>/gis)
    
    if (!rowMatches) {
      return []
    }
    
    const results: Array<{ date: string; price: string; volume?: string }> = []
    const skipRows = config.skipRows || 1 // 默认跳过表头
    
    for (let i = skipRows; i < rowMatches.length; i++) {
      const row = rowMatches[i]
      const cellMatches = row.match(/<td[^>]*>(.*?)<\/td>/gis)
      
      if (!cellMatches || cellMatches.length <= Math.max(config.dateColumn, config.priceColumn)) {
        continue
      }
      
      const date = this.extractTextFromHtml(cellMatches[config.dateColumn])
      const price = this.extractTextFromHtml(cellMatches[config.priceColumn])
      const volume = config.volumeColumn !== undefined && cellMatches[config.volumeColumn]
        ? this.extractTextFromHtml(cellMatches[config.volumeColumn])
        : undefined
      
      if (date && price) {
        results.push({ date, price, volume })
      }
    }
    
    return results
    
  } catch (error) {
    console.error('HTML table parsing failed:', error)
    return []
  }
}

/**
 * 从HTML中提取纯文本
 */
function extractTextFromHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '') // 移除HTML标签
    .replace(/&nbsp;/g, ' ') // 替换HTML实体
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim()
}

/**
 * 上传文件到S3存储
 */
export async function uploadToS3(
  filePath: string, 
  fileContent: Buffer | string,
  metadata?: Record<string, any>
): Promise<{ url: string; key: string }> {
  // TODO: 实现S3上传逻辑
  // 这里返回占位实现
  const key = `evidence/${Date.now()}-${filePath.split('/').pop()}`
  const url = `https://s3.amazonaws.com/${process.env.S3_BUCKET}/${key}`
  
  console.log(`File uploaded to S3: ${url}`)
  
  return { url, key }
}

/**
 * 计算文件SHA256哈希
 */
export async function calculateSHA256(content: Buffer | string): Promise<string> {
  const crypto = await import('crypto')
  const hash = crypto.createHash('sha256')
  hash.update(content)
  return hash.digest('hex')
}