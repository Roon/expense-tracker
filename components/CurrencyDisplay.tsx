// components/CurrencyDisplay.tsx
import { formatCurrency } from '@/lib/utils'

export function CurrencyDisplay({
  amount,
  className = '',
}: {
  amount: number
  className?: string
}) {
  return <span className={className}>{formatCurrency(amount)}</span>
}
