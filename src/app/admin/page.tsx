'use client'

import { useState } from 'react'
import { ArrowUpTrayIcon, DocumentTextIcon } from '@heroicons/react/24/outline'

interface ImportResult {
  success: boolean
  batchId?: string
  results?: {
    created: number
    updated: number
    failed: number
    total: number
  }
  warnings?: string[]
  errors?: any[]
}

export default function AdminPage() {
  const [file, setFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [dragActive, setDragActive] = useState(false)
  
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0])
    }
  }
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
    }
  }
  
  const handleImport = async () => {
    if (!file) return
    
    setImporting(true)
    setImportResult(null)
    
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('importedBy', 'admin')
      
      const response = await fetch('/api/import', {
        method: 'POST',
        body: formData
      })
      
      const result = await response.json()
      setImportResult(result)
      
      if (result.success) {
        setFile(null)
      }
    } catch (error) {
      setImportResult({
        success: false,
        errors: [{ message: error instanceof Error ? error.message : 'Unknown error' }]
      })
    } finally {
      setImporting(false)
    }
  }
  
  const downloadTemplate = () => {
    const link = document.createElement('a')
    link.href = '/templates/carbon-price-template.csv'
    link.download = 'carbon-price-template.csv'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }
  
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* 页面标题 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">数据管理后台</h1>
        <p className="mt-2 text-gray-600">
          碳价格数据批量导入与管理
        </p>
      </div>
      
      {/* CSV模板下载 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-blue-900">CSV模板下载</h3>
            <p className="text-sm text-blue-700 mt-1">
              下载标准CSV模板，填入数据后上传导入
            </p>
          </div>
          <button
            onClick={downloadTemplate}
            className="inline-flex items-center px-4 py-2 border border-blue-300 shadow-sm text-sm font-medium rounded-md text-blue-700 bg-white hover:bg-blue-50"
          >
            <DocumentTextIcon className="-ml-1 mr-2 h-4 w-4" />
            下载模板
          </button>
        </div>
      </div>
      
      {/* 文件上传区域 */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-lg font-medium text-gray-900 mb-4">数据导入</h2>
        
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center ${
            dragActive
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <ArrowUpTrayIcon className="mx-auto h-12 w-12 text-gray-400" />
          <div className="mt-4">
            <label htmlFor="file-upload" className="cursor-pointer">
              <span className="text-sm font-medium text-blue-600 hover:text-blue-500">
                点击上传文件
              </span>
              <span className="text-sm text-gray-500"> 或拖拽文件到此处</span>
              <input
                id="file-upload"
                name="file-upload"
                type="file"
                accept=".csv"
                className="sr-only"
                onChange={handleFileChange}
              />
            </label>
            <p className="text-xs text-gray-500 mt-1">
              支持CSV格式，最大10MB
            </p>
          </div>
        </div>
        
        {/* 选中的文件 */}
        {file && (
          <div className="mt-4 flex items-center justify-between bg-gray-50 rounded-lg p-4">
            <div className="flex items-center">
              <DocumentTextIcon className="h-5 w-5 text-gray-400 mr-2" />
              <span className="text-sm text-gray-900">{file.name}</span>
              <span className="text-xs text-gray-500 ml-2">
                ({(file.size / 1024).toFixed(1)} KB)
              </span>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setFile(null)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                移除
              </button>
              <button
                onClick={handleImport}
                disabled={importing}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
              >
                {importing ? '导入中...' : '开始导入'}
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* 导入结果 */}
      {importResult && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">导入结果</h2>
          
          <div className={`rounded-lg p-4 mb-4 ${
            importResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
          }`}>
            <p className={`font-medium ${
              importResult.success ? 'text-green-800' : 'text-red-800'
            }`}>
              {importResult.success ? '导入成功' : '导入失败'}
            </p>
            
            {importResult.results && (
              <div className="mt-2 text-sm text-gray-600">
                <p>总计: {importResult.results.total} 条记录</p>
                <p>新增: {importResult.results.created} 条</p>
                <p>更新: {importResult.results.updated} 条</p>
                <p>失败: {importResult.results.failed} 条</p>
              </div>
            )}
          </div>
          
          {/* 警告信息 */}
          {importResult.warnings && importResult.warnings.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <h4 className="font-medium text-yellow-800 mb-2">警告信息</h4>
              <ul className="text-sm text-yellow-700 space-y-1">
                {importResult.warnings.map((warning, index) => (
                  <li key={index}>• {warning}</li>
                ))}
              </ul>
            </div>
          )}
          
          {/* 错误信息 */}
          {importResult.errors && importResult.errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h4 className="font-medium text-red-800 mb-2">错误详情</h4>
              <div className="text-sm text-red-700 space-y-2 max-h-40 overflow-y-auto">
                {importResult.errors.map((error, index) => (
                  <div key={index} className="border-l-2 border-red-300 pl-2">
                    <p>行 {error.row}: {error.error}</p>
                    {error.row && error.row.market_code && (
                      <p className="text-xs text-red-600">
                        数据: {error.row.market_code} - {error.row.instrument_code} - {error.row.date}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* 数据质量规则说明 */}
      <div className="mt-8 bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">数据质量规则</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
          <div>
            <h4 className="font-medium text-gray-900 mb-2">验证规则</h4>
            <ul className="list-disc list-inside space-y-1">
              <li>价格必须为正数</li>
              <li>日期格式: YYYY-MM-DD</li>
              <li>日期不能为未来日期</li>
              <li>市场代码与货币匹配</li>
              <li>成交量非负数</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 mb-2">质量检查</h4>
            <ul className="list-disc list-inside space-y-1">
              <li>价格变动超过20%触发警告</li>
              <li>成交量为0或超过1M触发警告</li>
              <li>重复数据检测</li>
              <li>数据完整性检查</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}