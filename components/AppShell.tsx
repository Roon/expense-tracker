// components/AppShell.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CloudUpload, LayoutDashboard, List, PlusCircle } from 'lucide-react'
import { CloudExportProvider } from '@/components/cloud/CloudExportProvider'

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/expenses', label: 'Expenses', icon: List },
  { href: '/expenses/new', label: 'Add Expense', icon: PlusCircle },
  { href: '/export', label: 'Export', icon: CloudUpload },
] as const

function isActive(href: string, pathname: string): boolean {
  if (href === '/') return pathname === '/'
  if (href === '/expenses') return pathname === '/expenses' || (pathname.startsWith('/expenses/') && !pathname.startsWith('/expenses/new'))
  return pathname.startsWith(href)
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  // Shared-report links are opened by people who don't use the app: no navigation chrome.
  if (pathname.startsWith('/share')) return <div className="h-full overflow-auto">{children}</div>

  return (
    <CloudExportProvider>
      <div className="flex h-screen bg-gray-50">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex flex-col w-60 shrink-0 bg-white border-r border-gray-200">
          <div className="flex items-center gap-2 px-6 py-5 border-b border-gray-100">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
              <span className="text-white text-xs font-bold">$</span>
            </div>
            <span className="font-semibold text-gray-900 tracking-tight">ExpenseTracker</span>
          </div>

          <nav className="flex-1 p-3 space-y-0.5">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive(href, pathname)
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </Link>
            ))}
          </nav>

          <div className="p-4 border-t border-gray-100">
            <p className="text-xs text-gray-400">Data saved locally</p>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto pb-16 md:pb-0 min-h-0">
          {children}
        </main>

        {/* Mobile bottom tab bar */}
        <nav className="fixed bottom-0 inset-x-0 md:hidden bg-white border-t border-gray-200 flex z-50">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors ${
                isActive(href, pathname) ? 'text-indigo-600' : 'text-gray-500'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
      </div>
    </CloudExportProvider>
  )
}
