'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navigation = [
  { name: '总览', href: '/' },
  { name: 'EU ETS', href: '/markets/eu' },
  { name: 'UK ETS', href: '/markets/uk' },
  { name: 'California', href: '/markets/cca' },
  { name: '中国碳市场', href: '/markets/cea' },
  { name: 'CCER', href: '/markets/ccer' },
  { name: 'CDR', href: '/markets/cdr' },
  { name: '对比', href: '/compare' },
]

export default function Header() {
  const pathname = usePathname()
  
  return (
    <header className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link href="/" className="flex items-center">
              <span className="text-xl font-bold text-gray-900">碳资产数据平台</span>
            </Link>
          </div>
          
          <nav className="hidden md:flex space-x-1">
            {navigation.map((item) => {
              const isActive = pathname === item.href || 
                (item.href !== '/' && pathname.startsWith(item.href))
              
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  {item.name}
                </Link>
              )
            })}
          </nav>
          
          <div className="flex items-center space-x-4">
            <Link
              href="/monitoring"
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              监控
            </Link>
            <Link
              href="/admin"
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              管理后台
            </Link>
          </div>
        </div>
      </div>
    </header>
  )
}