'use client'

import Link from 'next/link'
import { ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/20/solid'

interface MarketCardProps {
  marketCode: string
  marketName: string
  latestPrice?: number
  currency?: string
  priceChange?: {
    dod?: number | null
    wow?: number | null
  }
  ma7?: number | null
  ma30?: number | null
  volume7d?: number | null
  lastUpdate?: string | null
}

export default function MarketCard({
  marketCode,
  marketName,
  latestPrice,
  currency,
  priceChange,
  ma7,
  ma30,
  volume7d,
  lastUpdate
}: MarketCardProps) {
  const formatPrice = (price: number, curr: string) => {
    const formatter = new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: curr,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
    return formatter.format(price)
  }
  
  const formatVolume = (volume: number) => {
    if (volume >= 1000000) {
      return `${(volume / 1000000).toFixed(1)}M`
    } else if (volume >= 1000) {
      return `${(volume / 1000).toFixed(0)}K`
    }
    return volume.toFixed(0)
  }
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)
  }
  
  const getPriceChangeColor = (change: number | null | undefined) => {
    if (!change) return 'text-gray-500'
    return change > 0 ? 'text-green-600' : 'text-red-600'
  }
  
  const getPriceChangeIcon = (change: number | null | undefined) => {
    if (!change || change === 0) return null
    return change > 0 
      ? <ArrowUpIcon className="w-4 h-4 text-green-600" />
      : <ArrowDownIcon className="w-4 h-4 text-red-600" />
  }
  
  return (
    <Link href={`/markets/${marketCode.toLowerCase()}`}>
      <div className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6 cursor-pointer">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{marketName}</h3>
            <p className="text-sm text-gray-500">{marketCode}</p>
          </div>
          {lastUpdate && (
            <p className="text-xs text-gray-400">
              {formatDate(lastUpdate)}
            </p>
          )}
        </div>
        
        {latestPrice && currency ? (
          <>
            <div className="mb-4">
              <p className="text-2xl font-bold text-gray-900">
                {formatPrice(latestPrice, currency)}
              </p>
              <p className="text-xs text-gray-500 mt-1">每吨CO₂当量</p>
            </div>
            
            <div className="grid grid-cols-2 gap-3 text-sm">
              {priceChange?.dod !== null && (
                <div>
                  <p className="text-gray-500">日涨跌</p>
                  <div className="flex items-center space-x-1">
                    {getPriceChangeIcon(priceChange.dod)}
                    <span className={`font-medium ${getPriceChangeColor(priceChange.dod)}`}>
                      {priceChange.dod > 0 ? '+' : ''}{priceChange.dod?.toFixed(2)}%
                    </span>
                  </div>
                </div>
              )}
              
              {priceChange?.wow !== null && (
                <div>
                  <p className="text-gray-500">周涨跌</p>
                  <div className="flex items-center space-x-1">
                    {getPriceChangeIcon(priceChange.wow)}
                    <span className={`font-medium ${getPriceChangeColor(priceChange.wow)}`}>
                      {priceChange.wow > 0 ? '+' : ''}{priceChange.wow?.toFixed(2)}%
                    </span>
                  </div>
                </div>
              )}
              
              {ma7 !== null && (
                <div>
                  <p className="text-gray-500">7日均线</p>
                  <p className="font-medium text-gray-900">
                    {formatPrice(ma7, currency)}
                  </p>
                </div>
              )}
              
              {ma30 !== null && (
                <div>
                  <p className="text-gray-500">30日均线</p>
                  <p className="font-medium text-gray-900">
                    {formatPrice(ma30, currency)}
                  </p>
                </div>
              )}
              
              {volume7d !== null && (
                <div className="col-span-2">
                  <p className="text-gray-500">7日成交量</p>
                  <p className="font-medium text-gray-900">
                    {formatVolume(volume7d)} tCO₂e
                  </p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-400">暂无数据</p>
          </div>
        )}
      </div>
    </Link>
  )
}