'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline'

// 动态导入ECharts组件
const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false })

interface PriceData {
  date: string
  marketCode: string
  instrumentCode: string
  price: number
  currency: string
}

const marketOptions = [
  { code: 'EU', name: 'EU ETS', color: '#3b82f6' },
  { code: 'UK', name: 'UK ETS', color: '#10b981' },
  { code: 'CCA', name: 'California', color: '#f59e0b' },
  { code: 'CEA', name: '中国碳市场', color: '#ef4444' },
  { code: 'CCER', name: 'CCER', color: '#8b5cf6' },
  { code: 'CDR', name: 'CDR', color: '#ec4899' }
]

export default function ComparePage() {
  const [priceData, setPriceData] = useState<PriceData[]>([])
  const [selectedMarkets, setSelectedMarkets] = useState<string[]>(['EU', 'UK'])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState(90)
  const [viewMode, setViewMode] = useState<'absolute' | 'normalized'>('absolute')
  
  useEffect(() => {
    fetchCompareData()
  }, [selectedMarkets, dateRange])
  
  const fetchCompareData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const endDate = new Date()
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - dateRange)
      
      // 并行获取多个市场的数据
      const promises = selectedMarkets.map(async marketCode => {
        const queryParams = new URLSearchParams({
          marketCode,
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          pageSize: '1000',
          sortBy: 'date',
          sortOrder: 'asc'
        })
        
        const response = await fetch(`/api/prices?${queryParams}`)
        if (!response.ok) {
          throw new Error(`Failed to fetch data for ${marketCode}`)
        }
        
        const data = await response.json()
        return data.success ? data.data : []
      })
      
      const results = await Promise.all(promises)
      const allData = results.flat()
      setPriceData(allData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }
  
  const handleMarketToggle = (marketCode: string) => {
    setSelectedMarkets(prev => 
      prev.includes(marketCode)
        ? prev.filter(m => m !== marketCode)
        : [...prev, marketCode]
    )
  }
  
  const handleExportCompare = async () => {
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - dateRange)
    
    const queryParams = new URLSearchParams({
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      format: 'csv'
    })
    
    window.open(`/api/prices/export?${queryParams}`, '_blank')
  }
  
  // 准备图表数据
  const getCompareChartOption = () => {
    if (priceData.length === 0) return {}
    
    // 按日期分组数据
    const dataByDate: Record<string, Record<string, number>> = {}
    priceData.forEach(item => {
      if (!dataByDate[item.date]) {
        dataByDate[item.date] = {}
      }
      dataByDate[item.date][item.marketCode] = item.price
    })
    
    const dates = Object.keys(dataByDate).sort()
    
    // 为标准化视图计算基准（以第一个有效数据点为100%）
    const normalizedData: Record<string, number[]> = {}
    selectedMarkets.forEach(market => {
      const marketData = dates.map(date => dataByDate[date]?.[market] || null)
      const firstValidPrice = marketData.find(price => price !== null)
      
      if (viewMode === 'normalized' && firstValidPrice) {
        normalizedData[market] = marketData.map(price => 
          price ? (price / firstValidPrice) * 100 : null
        )
      } else {
        normalizedData[market] = marketData
      }
    })
    
    const marketColors = Object.fromEntries(
      marketOptions.map(m => [m.code, m.color])
    )
    
    return {
      title: {
        text: viewMode === 'normalized' ? '市场价格对比（标准化）' : '市场价格对比（绝对值）',
        left: 'center'
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross'
        },
        formatter: function(params: any[]) {
          let result = `<div><strong>${params[0].axisValue}</strong></div>`
          params.forEach(param => {
            const market = marketOptions.find(m => m.code === param.seriesName)
            const value = viewMode === 'normalized' 
              ? `${param.value?.toFixed(2)}%`
              : `${param.value?.toFixed(2)} ${param.seriesName === 'CEA' || param.seriesName === 'CCER' ? 'CNY' : param.seriesName === 'EU' ? 'EUR' : param.seriesName === 'UK' ? 'GBP' : 'USD'}`
            
            result += `<div style="color: ${param.color}">
              <span style="display:inline-block;margin-right:5px;border-radius:10px;width:10px;height:10px;background-color:${param.color};"></span>
              ${market?.name || param.seriesName}: ${value}
            </div>`
          })
          return result
        }
      },
      legend: {
        data: selectedMarkets.map(market => {
          const marketInfo = marketOptions.find(m => m.code === market)
          return marketInfo?.name || market
        }),
        bottom: 0
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '10%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: dates,
        boundaryGap: false,
        axisLabel: {
          formatter: (value: string) => {
            const date = new Date(value)
            return `${date.getMonth() + 1}/${date.getDate()}`
          }
        }
      },
      yAxis: {
        type: 'value',
        name: viewMode === 'normalized' ? '相对价格 (%)' : '价格',
        axisLabel: {
          formatter: viewMode === 'normalized' ? '{value}%' : '{value}'
        }
      },
      series: selectedMarkets.map(market => {
        const marketInfo = marketOptions.find(m => m.code === market)
        return {
          name: marketInfo?.name || market,
          type: 'line',
          data: normalizedData[market],
          smooth: true,
          lineStyle: {
            width: 2
          },
          itemStyle: {
            color: marketColors[market] || '#666666'
          },
          connectNulls: false
        }
      })
    }
  }
  
  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
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
        </div>
      </div>
    )
  }
  
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* 页面标题 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">市场对比分析</h1>
        <p className="mt-2 text-gray-600">
          跨市场价格对比与价差分析
        </p>
      </div>
      
      {/* 控制面板 */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 市场选择 */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">选择市场</h3>
            <div className="space-y-2">
              {marketOptions.map(market => (
                <label key={market.code} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedMarkets.includes(market.code)}
                    onChange={() => handleMarketToggle(market.code)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">{market.name}</span>
                  <div
                    className="ml-2 w-3 h-3 rounded-full"
                    style={{ backgroundColor: market.color }}
                  />
                </label>
              ))}
            </div>
          </div>
          
          {/* 时间范围 */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">时间范围</h3>
            <div className="grid grid-cols-2 gap-2">
              {[30, 90, 180, 365].map(days => (
                <button
                  key={days}
                  onClick={() => setDateRange(days)}
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    dateRange === days
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {days === 365 ? '1年' : `${days}天`}
                </button>
              ))}
            </div>
          </div>
          
          {/* 显示模式和导出 */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">显示选项</h3>
            <div className="space-y-3">
              <div className="flex space-x-2">
                <button
                  onClick={() => setViewMode('absolute')}
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    viewMode === 'absolute'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  绝对价格
                </button>
                <button
                  onClick={() => setViewMode('normalized')}
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    viewMode === 'normalized'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  标准化
                </button>
              </div>
              
              <button
                onClick={handleExportCompare}
                className="w-full inline-flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                <ArrowDownTrayIcon className="-ml-1 mr-2 h-4 w-4" />
                导出数据
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* 对比图表 */}
      {priceData.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <ReactECharts
            option={getCompareChartOption()}
            style={{ height: '500px' }}
            notMerge={true}
            lazyUpdate={true}
          />
        </div>
      )}
      
      {/* 价差分析表格 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">价差分析</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  市场对
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  当前价差
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  7日均价差
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  30日均价差
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  价差趋势
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {/* 这里可以添加价差计算逻辑 */}
              <tr>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  EUA - UKA
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  30.30 EUR
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  29.85 EUR
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  31.20 EUR
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                    扩大
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      
      {/* 说明信息 */}
      <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-sm text-yellow-800">
          <strong>注意：</strong> 跨市场价格对比需要考虑汇率差异。当前显示为各市场原始货币价格，
          标准化视图以各市场第一个数据点为基准进行相对比较。
        </p>
      </div>
    </div>
  )
}