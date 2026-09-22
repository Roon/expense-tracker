// components/EmptyState.tsx
import Link from 'next/link'
import { PlusCircle } from 'lucide-react'

export function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
}: {
  title: string
  description: string
  actionLabel: string
  actionHref: string
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center mb-4">
        <span className="text-3xl">💸</span>
      </div>
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      <p className="text-gray-500 mt-1 text-sm max-w-sm">{description}</p>
      <Link
        href={actionHref}
        className="mt-5 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
      >
        <PlusCircle className="w-4 h-4" />
        {actionLabel}
      </Link>
    </div>
  )
}
