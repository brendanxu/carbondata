'use client'

import { useEffect, useState } from 'react'
import MarketCard from '@/components/cards/MarketCard'
import { ArrowPathIcon } from '@heroicons/react/24/outline'

interface MarketSummary {
  marketCode: string
  marketName: string
  region: string
  instruments: Array<{
    instrumentCode: string
    instrumentName: string
    currency: string
    unit: string
    latestPrice?: {
      date: string
      price: number
      priceType: string
      volume: number | null
      venue: string | null
    }
    changes?: {
      dod: number | null
      wow: number | null
    }
    movingAverages?: {
      ma7: number | null
      ma30: number | null
    }
    volume7d?: number | null
    lastUpdate?: string
  }>
  lastUpdate: string | null
}

export default function HomePage() {
  const [summaryData, setSummaryData] = useState<MarketSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  
  const fetchSummaryData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch('/api/summary')
      if (!response.ok) {
        throw new Error('Failed to fetch summary data')
      }
      
      const data = await response.json()
      if (data.success && data.data) {
        setSummaryData(data.data.markets)
        setLastRefresh(new Date())
      } else {
        throw new Error(data.error || 'Failed to fetch data')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }
  
  useEffect(() => {
    fetchSummaryData()
    
    // 每5分钟自动刷新
    const interval = setInterval(fetchSummaryData, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])
  
  const handleRefresh = () => {
    fetchSummaryData()
  }
  
  const formatLastRefresh = () => {
    return new Intl.DateTimeFormat('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(lastRefresh)
  }
  
  if (loading && summaryData.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 mb-4">
            <ArrowPathIcon className="w-6 h-6 text-blue-600 animate-spin" />
          </div>
          <p className="text-gray-500">加载数据中...</p>
        </div>
      </div>
    )
  }
  
  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">错误: {error}</p>
          <button
            onClick={handleRefresh}
            className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
          >
            重试
          </button>
        </div>
      </div>
    )
  }
  
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* 页面标题 */}
      <div className="mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">碳市场数据总览</h1>
            <p className="mt-2 text-gray-600">
              全球主要碳市场每日价格数据，实时更新
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-500">
              最后更新: {formatLastRefresh()}
            </span>
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <ArrowPathIcon className={`-ml-0.5 mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              刷新
            </button>
          </div>
        </div>
      </div>
      
      {/* 市场卡片网格 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {summaryData.map((market) => {
          // 获取第一个工具的数据作为市场展示数据
          const primaryInstrument = market.instruments[0]
          
          return (
            <MarketCard
              key={market.marketCode}
              marketCode={market.marketCode}
              marketName={market.marketName}
              latestPrice={primaryInstrument?.latestPrice?.price}
              currency={primaryInstrument?.currency}
              priceChange={primaryInstrument?.changes}
              ma7={primaryInstrument?.movingAverages?.ma7}
              ma30={primaryInstrument?.movingAverages?.ma30}
              volume7d={primaryInstrument?.volume7d}
              lastUpdate={primaryInstrument?.lastUpdate}
            />
          )
        })}
      </div>
      
      {/* 数据说明 */}
      <div className="mt-12 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-blue-900 mb-3">数据说明</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-800">
          <div>
            <p className="font-medium mb-1">数据来源</p>
            <ul className="list-disc list-inside space-y-1 text-blue-700">
              <li>EU ETS / UK ETS: ICE Endex, EEX</li>
              <li>California: CARB官方数据</li>
              <li>中国碳市场: 上海/北京环境能源交易所</li>
              <li>CDR: 行业聚合数据</li>
            </ul>
          </div>
          <div>
            <p className="font-medium mb-1">更新频率</p>
            <ul className="list-disc list-inside space-y-1 text-blue-700">
              <li>工作日每日更新（节假日除外）</li>
              <li>欧美市场: 北京时间凌晨更新</li>
              <li>中国市场: 北京时间17:30后更新</li>
              <li>数据延迟: 约1-2小时</li>
            </ul>
          </div>
        </div>
        <p className="mt-4 text-xs text-blue-600">
          * 所有价格数据仅供参考，实际交易请以官方交易所数据为准
        </p>
      </div>
    </div>
  )
}