'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline'

// 动态导入ECharts组件，避免SSR问题
const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false })

interface PriceData {
  id: string
  date: string
  marketCode: string
  marketName: string
  instrumentCode: string
  instrumentName: string
  price: number
  priceType: string
  currency: string
  unit: string
  volume: number | null
  venueName: string | null
  sourceUrl: string | null
  qaStatus: string
  collectedAt: string
  collectedBy: string | null
  notes: string | null
}

const marketInfo: Record<string, { name: string; description: string }> = {
  eu: {
    name: 'EU ETS',
    description: '欧盟碳排放交易体系（EU Emissions Trading System）是全球最大的碳市场，覆盖欧盟27个成员国。'
  },
  uk: {
    name: 'UK ETS',
    description: '英国碳排放交易体系（UK Emissions Trading System）自2021年脱欧后独立运行。'
  },
  cca: {
    name: 'California Cap-and-Trade',
    description: '加州碳限额交易计划是北美最大的碳市场，与魁北克联合运行。'
  },
  cea: {
    name: '中国全国碳市场',
    description: '中国全国碳排放权交易市场是全球覆盖排放量最大的碳市场，主要覆盖电力行业。'
  },
  ccer: {
    name: '中国CCER',
    description: '中国核证自愿减排量（CCER）是中国的自愿碳减排市场。'
  },
  cdr: {
    name: 'Carbon Removal',
    description: '碳清除（CDR）市场包括直接空气捕获、生物炭等永久碳清除技术。'
  }
}

export default function MarketDetailPage() {
  const params = useParams()
  const marketCode = params.code as string
  const [priceData, setPriceData] = useState<PriceData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState(30) // 默认显示30天
  
  const marketDetails = marketInfo[marketCode] || { 
    name: marketCode.toUpperCase(), 
    description: '市场数据' 
  }
  
  useEffect(() => {
    fetchMarketData()
  }, [marketCode, dateRange])
  
  const fetchMarketData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const endDate = new Date()
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - dateRange)
      
      const queryParams = new URLSearchParams({
        marketCode: marketCode.toUpperCase(),
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        pageSize: '1000',
        sortBy: 'date',
        sortOrder: 'asc'
      })
      
      const response = await fetch(`/api/prices?${queryParams}`)
      if (!response.ok) {
        throw new Error('Failed to fetch market data')
      }
      
      const data = await response.json()
      if (data.success && data.data) {
        setPriceData(data.data)
      } else {
        throw new Error(data.error || 'Failed to fetch data')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }
  
  const handleExport = async () => {
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - dateRange)
    
    const queryParams = new URLSearchParams({
      marketCode: marketCode.toUpperCase(),
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      format: 'csv'
    })
    
    window.open(`/api/prices/export?${queryParams}`, '_blank')
  }
  
  // 准备图表数据
  const getChartOption = () => {
    if (priceData.length === 0) return {}
    
    const dates = priceData.map(d => d.date)
    const prices = priceData.map(d => d.price)
    const volumes = priceData.map(d => d.volume || 0)
    
    // 计算移动平均线
    const ma7 = prices.map((_, index) => {
      if (index < 6) return null
      const sum = prices.slice(index - 6, index + 1).reduce((a, b) => a + b, 0)
      return (sum / 7).toFixed(2)
    })
    
    const ma30 = prices.map((_, index) => {
      if (index < 29) return null
      const sum = prices.slice(index - 29, index + 1).reduce((a, b) => a + b, 0)
      return (sum / 30).toFixed(2)
    })
    
    return {
      title: {
        text: `${marketDetails.name} 价格走势`,
        left: 'center'
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross'
        }
      },
      legend: {
        data: ['价格', 'MA7', 'MA30', '成交量'],
        bottom: 0
      },
      grid: [
        {
          left: '10%',
          right: '10%',
          height: '50%'
        },
        {
          left: '10%',
          right: '10%',
          top: '70%',
          height: '15%'
        }
      ],
      xAxis: [
        {
          type: 'category',
          data: dates,
          gridIndex: 0,
          axisLabel: {
            formatter: (value: string) => {
              const date = new Date(value)
              return `${date.getMonth() + 1}/${date.getDate()}`
            }
          }
        },
        {
          type: 'category',
          data: dates,
          gridIndex: 1,
          axisLabel: { show: false }
        }
      ],
      yAxis: [
        {
          type: 'value',
          name: `价格 (${priceData[0]?.currency}/tCO₂e)`,
          gridIndex: 0
        },
        {
          type: 'value',
          name: '成交量 (tCO₂e)',
          gridIndex: 1
        }
      ],
      series: [
        {
          name: '价格',
          type: 'line',
          data: prices,
          smooth: true,
          xAxisIndex: 0,
          yAxisIndex: 0,
          itemStyle: {
            color: '#3b82f6'
          }
        },
        {
          name: 'MA7',
          type: 'line',
          data: ma7,
          smooth: true,
          xAxisIndex: 0,
          yAxisIndex: 0,
          lineStyle: {
            opacity: 0.5
          },
          itemStyle: {
            color: '#10b981'
          }
        },
        {
          name: 'MA30',
          type: 'line',
          data: ma30,
          smooth: true,
          xAxisIndex: 0,
          yAxisIndex: 0,
          lineStyle: {
            opacity: 0.5
          },
          itemStyle: {
            color: '#f59e0b'
          }
        },
        {
          name: '成交量',
          type: 'bar',
          data: volumes,
          xAxisIndex: 1,
          yAxisIndex: 1,
          itemStyle: {
            color: '#6b7280'
          }
        }
      ]
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
        <h1 className="text-3xl font-bold text-gray-900">{marketDetails.name}</h1>
        <p className="mt-2 text-gray-600">{marketDetails.description}</p>
      </div>
      
      {/* 时间范围选择和导出按钮 */}
      <div className="mb-6 flex justify-between items-center">
        <div className="flex space-x-2">
          {[7, 30, 90, 365].map(days => (
            <button
              key={days}
              onClick={() => setDateRange(days)}
              className={`px-4 py-2 rounded-md text-sm font-medium ${
                dateRange === days
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {days === 365 ? '1年' : `${days}天`}
            </button>
          ))}
        </div>
        
        <button
          onClick={handleExport}
          className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
        >
          <ArrowDownTrayIcon className="-ml-1 mr-2 h-5 w-5" />
          导出CSV
        </button>
      </div>
      
      {/* 价格图表 */}
      {priceData.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <ReactECharts
            option={getChartOption()}
            style={{ height: '500px' }}
            notMerge={true}
            lazyUpdate={true}
          />
        </div>
      )}
      
      {/* 数据表格 */}
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            历史价格数据
          </h3>
        </div>
        <div className="border-t border-gray-200">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    日期
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    价格
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    成交量
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    交易场所
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    状态
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {priceData.slice().reverse().map((price) => (
                  <tr key={price.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {price.date}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {new Intl.NumberFormat('zh-CN', {
                        style: 'currency',
                        currency: price.currency
                      }).format(price.price)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {price.volume ? 
                        new Intl.NumberFormat('zh-CN').format(price.volume) : 
                        '-'
                      }
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {price.venueName || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        price.qaStatus === 'APPROVED' 
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {price.qaStatus === 'APPROVED' ? '已审核' : '待审核'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}