// components/cloud/IntegrationLogo.tsx
import { INTEGRATIONS } from '@/lib/cloud/integrations'
import type { ConnectionStatus, DestinationId } from '@/lib/cloud/types'

/**
 * Neutral monogram tiles rather than real brand marks: this is a demo and
 * shouldn't imply an official integration.
 */
export function IntegrationLogo({
  id,
  size = 'md',
  status,
}: {
  id: DestinationId
  size?: 'sm' | 'md' | 'lg'
  status?: ConnectionStatus
}) {
  const i = INTEGRATIONS[id]
  const dims = size === 'sm' ? 'h-7 w-7 text-[11px]' : size === 'lg' ? 'h-12 w-12 text-base' : 'h-9 w-9 text-xs'
  return (
    <span className={`relative inline-flex shrink-0 items-center justify-center rounded-lg font-bold text-white ${i.color} ${dims}`} aria-hidden>
      {i.monogram}
      {status && (
        <span
          className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white ${
            status === 'syncing' ? 'animate-pulse bg-sky-400' : status === 'error' ? 'bg-red-500' : 'bg-emerald-500'
          }`}
        />
      )}
    </span>
  )
}

export function DemoBadge({ className = '' }: { className?: string }) {
  return (
    <span
      title="Simulated integration: nothing leaves your device"
      className={`inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 ${className}`}
    >
      Demo
    </span>
  )
}
