'use client'

import { useEffect, useState } from 'react'
import { 
  CheckCircleIcon, 
  ExclamationTriangleIcon, 
  XCircleIcon,
  ClockIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline'

interface HealthData {
  overallStatus: 'healthy' | 'warning' | 'unhealthy'
  checkTime: string
  markets: Array<{
    marketCode: string
    marketName: string
    status: 'healthy' | 'warning' | 'stale' | 'no_data'
    lastUpdate: string | null
    daysSinceUpdate: number | null
    collectedAt: string
  }>
  summary: {
    totalMarkets: number
    healthyMarkets: number
    warningMarkets: number
    staleMarkets: number
    noDataMarkets: number
  }
}

export default function MonitoringPage() {
  const [healthData, setHealthData] = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  useEffect(() => {
    fetchHealthData()
    
    // 每分钟刷新一次
    const interval = setInterval(fetchHealthData, 60000)
    return () => clearInterval(interval)
  }, [])
  
  const fetchHealthData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch('/api/monitoring/data-freshness')
      if (!response.ok) {
        throw new Error('Failed to fetch health data')
      }
      
      const data = await response.json()
      if (data.success && data.data) {
        setHealthData(data.data)
      } else {
        throw new Error(data.error || 'Failed to fetch data')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircleIcon className="w-5 h-5 text-green-500" />
      case 'warning':
        return <ExclamationTriangleIcon className="w-5 h-5 text-yellow-500" />
      case 'stale':
      case 'unhealthy':
        return <XCircleIcon className="w-5 h-5 text-red-500" />
      case 'no_data':
        return <ClockIcon className="w-5 h-5 text-gray-500" />
      default:
        return <ClockIcon className="w-5 h-5 text-gray-500" />
    }
  }
  
  const getStatusText = (status: string) => {
    switch (status) {
      case 'healthy': return '正常'
      case 'warning': return '警告'
      case 'stale': return '过期'
      case 'no_data': return '无数据'
      case 'unhealthy': return '异常'
      default: return '未知'
    }
  }
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-100 text-green-800'
      case 'warning': return 'bg-yellow-100 text-yellow-800'
      case 'stale': 
      case 'unhealthy': return 'bg-red-100 text-red-800'
      case 'no_data': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }
  
  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <ArrowPathIcon className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-500">加载监控数据...</p>
        </div>
      </div>
    )
  }
  
  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">监控数据加载失败: {error}</p>
          <button
            onClick={fetchHealthData}
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
        <h1 className="text-3xl font-bold text-gray-900">系统监控</h1>
        <p className="mt-2 text-gray-600">
          数据新鲜度与系统健康状态监控
        </p>
      </div>
      
      {healthData && (
        <>
          {/* 整体状态卡片 */}
          <div className="mb-8">
            <div className={`rounded-lg p-6 ${
              healthData.overallStatus === 'healthy' 
                ? 'bg-green-50 border border-green-200'
                : healthData.overallStatus === 'warning'
                  ? 'bg-yellow-50 border border-yellow-200'
                  : 'bg-red-50 border border-red-200'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  {getStatusIcon(healthData.overallStatus)}
                  <div className="ml-3">
                    <h2 className={`text-lg font-medium ${
                      healthData.overallStatus === 'healthy' ? 'text-green-900' :
                      healthData.overallStatus === 'warning' ? 'text-yellow-900' :
                      'text-red-900'
                    }`}>
                      系统状态: {getStatusText(healthData.overallStatus)}
                    </h2>
                    <p className="text-sm text-gray-600">
                      检查时间: {new Date(healthData.checkTime).toLocaleString('zh-CN')}
                    </p>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">正常市场</p>
                      <p className="text-lg font-semibold text-green-600">
                        {healthData.summary.healthyMarkets}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">异常市场</p>
                      <p className="text-lg font-semibold text-red-600">
                        {healthData.summary.staleMarkets + healthData.summary.noDataMarkets}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* 市场状态详情 */}
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                市场数据状态
              </h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">
                各市场最新数据更新状态和新鲜度
              </p>
            </div>
            <div className="border-t border-gray-200">
              <ul className="divide-y divide-gray-200">
                {healthData.markets.map((market) => (
                  <li key={market.marketCode} className="px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        {getStatusIcon(market.status)}
                        <div className="ml-3">
                          <p className="text-sm font-medium text-gray-900">
                            {market.marketName}
                          </p>
                          <p className="text-sm text-gray-500">
                            {market.marketCode}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <p className="text-sm text-gray-900">
                            最后更新: {market.lastUpdate || '无数据'}
                          </p>
                          {market.daysSinceUpdate !== null && (
                            <p className="text-sm text-gray-500">
                              {market.daysSinceUpdate === 0 ? '今天' : `${market.daysSinceUpdate}天前`}
                            </p>
                          )}
                        </div>
                        
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(market.status)}`}>
                          {getStatusText(market.status)}
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          
          {/* 监控指标 */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <CheckCircleIcon className="w-8 h-8 text-green-500" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">正常市场</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {healthData.summary.healthyMarkets}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <ExclamationTriangleIcon className="w-8 h-8 text-yellow-500" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">警告市场</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {healthData.summary.warningMarkets}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <XCircleIcon className="w-8 h-8 text-red-500" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">过期市场</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {healthData.summary.staleMarkets}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <ClockIcon className="w-8 h-8 text-gray-500" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">无数据市场</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {healthData.summary.noDataMarkets}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
      
      {/* 监控说明 */}
      <div className="mt-8 bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">监控规则</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
          <div>
            <h4 className="font-medium text-gray-900 mb-2">数据新鲜度标准</h4>
            <ul className="list-disc list-inside space-y-1">
              <li>正常: ≤1天未更新</li>
              <li>警告: 2-3天未更新</li>
              <li>过期: >3天未更新（触发告警）</li>
              <li>无数据: 从未有数据</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 mb-2">告警策略</h4>
            <ul className="list-disc list-inside space-y-1">
              <li>数据过期: 自动发送告警通知</li>
              <li>系统错误: 立即通知技术团队</li>
              <li>价格异常: 变动>20%时警告</li>
              <li>导入失败: 批量导入失败时通知</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}