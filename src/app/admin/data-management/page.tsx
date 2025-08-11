'use client'

import { useEffect, useState } from 'react'
import { 
  PencilIcon, 
  TrashIcon, 
  CheckIcon, 
  XMarkIcon,
  EyeIcon 
} from '@heroicons/react/24/outline'

interface PriceRecord {
  id: string
  date: string
  marketCode: string
  instrumentCode: string
  price: number
  currency: string
  volume: number | null
  qaStatus: string
  sourceUrl: string | null
  collectedBy: string | null
  notes: string | null
}

export default function DataManagementPage() {
  const [records, setRecords] = useState<PriceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRecords, setSelectedRecords] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState({
    marketCode: '',
    qaStatus: '',
    dateFrom: '',
    dateTo: ''
  })

  useEffect(() => {
    fetchRecords()
  }, [filter])

  const fetchRecords = async () => {
    try {
      setLoading(true)
      
      const queryParams = new URLSearchParams()
      if (filter.marketCode) queryParams.set('marketCode', filter.marketCode)
      if (filter.qaStatus) queryParams.set('qaStatus', filter.qaStatus)
      if (filter.dateFrom) queryParams.set('startDate', filter.dateFrom)
      if (filter.dateTo) queryParams.set('endDate', filter.dateTo)
      queryParams.set('pageSize', '100')
      
      const response = await fetch(`/api/prices?${queryParams}`)
      const data = await response.json()
      
      if (data.success) {
        setRecords(data.data)
      }
    } catch (error) {
      console.error('Failed to fetch records:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleBatchApprove = async () => {
    if (selectedRecords.size === 0) return
    
    try {
      const promises = Array.from(selectedRecords).map(id => 
        fetch(`/api/admin/prices/${id}/approve`, { method: 'POST' })
      )
      
      await Promise.all(promises)
      await fetchRecords()
      setSelectedRecords(new Set())
    } catch (error) {
      console.error('Batch approve failed:', error)
    }
  }

  const handleBatchReject = async () => {
    if (selectedRecords.size === 0) return
    
    try {
      const promises = Array.from(selectedRecords).map(id => 
        fetch(`/api/admin/prices/${id}/reject`, { method: 'POST' })
      )
      
      await Promise.all(promises)
      await fetchRecords()
      setSelectedRecords(new Set())
    } catch (error) {
      console.error('Batch reject failed:', error)
    }
  }

  const toggleRecordSelection = (id: string) => {
    const newSelected = new Set(selectedRecords)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedRecords(newSelected)
  }

  const toggleSelectAll = () => {
    if (selectedRecords.size === records.length) {
      setSelectedRecords(new Set())
    } else {
      setSelectedRecords(new Set(records.map(r => r.id)))
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">数据管理</h1>
        <p className="mt-2 text-gray-600">价格数据审核与管理</p>
      </div>

      {/* 过滤器 */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-lg font-medium text-gray-900 mb-4">数据筛选</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              市场
            </label>
            <select
              value={filter.marketCode}
              onChange={(e) => setFilter(prev => ({ ...prev, marketCode: e.target.value }))}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">全部市场</option>
              <option value="EU">EU ETS</option>
              <option value="UK">UK ETS</option>
              <option value="CCA">California</option>
              <option value="CEA">中国碳市场</option>
              <option value="CCER">CCER</option>
              <option value="CDR">CDR</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              审核状态
            </label>
            <select
              value={filter.qaStatus}
              onChange={(e) => setFilter(prev => ({ ...prev, qaStatus: e.target.value }))}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">全部状态</option>
              <option value="PENDING">待审核</option>
              <option value="APPROVED">已通过</option>
              <option value="REJECTED">已拒绝</option>
              <option value="REVIEWING">审核中</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              开始日期
            </label>
            <input
              type="date"
              value={filter.dateFrom}
              onChange={(e) => setFilter(prev => ({ ...prev, dateFrom: e.target.value }))}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              结束日期
            </label>
            <input
              type="date"
              value={filter.dateTo}
              onChange={(e) => setFilter(prev => ({ ...prev, dateTo: e.target.value }))}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* 批量操作 */}
      {selectedRecords.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <span className="text-sm text-blue-800">
              已选择 {selectedRecords.size} 条记录
            </span>
            <div className="flex space-x-2">
              <button
                onClick={handleBatchApprove}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
              >
                <CheckIcon className="-ml-0.5 mr-1.5 h-4 w-4" />
                批量通过
              </button>
              <button
                onClick={handleBatchReject}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
              >
                <XMarkIcon className="-ml-0.5 mr-1.5 h-4 w-4" />
                批量拒绝
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 数据表格 */}
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={records.length > 0 && selectedRecords.size === records.length}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  日期
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  市场
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  价格
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  成交量
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  状态
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {records.map((record) => (
                <tr key={record.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selectedRecords.has(record.id)}
                      onChange={() => toggleRecordSelection(record.id)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {record.date}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {record.marketCode}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {new Intl.NumberFormat('zh-CN', {
                      style: 'currency',
                      currency: record.currency
                    }).format(record.price)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {record.volume ? 
                      new Intl.NumberFormat('zh-CN').format(record.volume) : 
                      '-'
                    }
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      record.qaStatus === 'APPROVED' 
                        ? 'bg-green-100 text-green-800'
                        : record.qaStatus === 'REJECTED'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {record.qaStatus === 'APPROVED' ? '已通过' : 
                       record.qaStatus === 'REJECTED' ? '已拒绝' : '待审核'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex space-x-2">
                      {record.sourceUrl && (
                        <a
                          href={record.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-900"
                          title="查看数据源"
                        >
                          <EyeIcon className="h-4 w-4" />
                        </a>
                      )}
                      <button
                        className="text-indigo-600 hover:text-indigo-900"
                        title="编辑"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <button
                        className="text-red-600 hover:text-red-900"
                        title="删除"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 统计信息 */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-gray-500">总记录数</div>
          <div className="text-2xl font-bold text-gray-900">{records.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-gray-500">待审核</div>
          <div className="text-2xl font-bold text-yellow-600">
            {records.filter(r => r.qaStatus === 'PENDING').length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-gray-500">已通过</div>
          <div className="text-2xl font-bold text-green-600">
            {records.filter(r => r.qaStatus === 'APPROVED').length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-gray-500">已拒绝</div>
          <div className="text-2xl font-bold text-red-600">
            {records.filter(r => r.qaStatus === 'REJECTED').length}
          </div>
        </div>
      </div>
    </div>
  )
}