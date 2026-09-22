// components/CategoryBadge.tsx
import { CATEGORY_BADGE_COLORS } from '@/lib/types'
import type { Category } from '@/lib/types'

export function CategoryBadge({ category }: { category: Category }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${CATEGORY_BADGE_COLORS[category]}`}
    >
      {category}
    </span>
  )
}
