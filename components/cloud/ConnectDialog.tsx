// components/cloud/ConnectDialog.tsx
'use client'

import { useEffect, useState } from 'react'
import { Check, LoaderCircle, ShieldCheck } from 'lucide-react'
import { INTEGRATIONS } from '@/lib/cloud/integrations'
import type { DestinationId } from '@/lib/cloud/types'
import { DemoBadge, IntegrationLogo } from './IntegrationLogo'
import { Modal } from './Modal'
import { Field, inputClass } from './DestinationConfigEditor'

type Step = 'consent' | 'authorizing' | 'done'

/** Simulated OAuth consent flow. No network requests are made. */
export function ConnectDialog({
  id,
  onConnect,
  onClose,
  authorizeDelayMs = 1100,
}: {
  id: DestinationId
  onConnect: (account: string) => void
  onClose: () => void
  authorizeDelayMs?: number
}) {
  const integration = INTEGRATIONS[id]
  const [step, setStep] = useState<Step>('consent')
  const [account, setAccount] = useState('demo.user@example.com')

  useEffect(() => {
    if (step === 'authorizing') {
      const t = setTimeout(() => {
        onConnect(account.trim() || 'demo.user@example.com')
        setStep('done')
      }, authorizeDelayMs)
      return () => clearTimeout(t)
    }
    if (step === 'done') {
      const t = setTimeout(onClose, 900)
      return () => clearTimeout(t)
    }
  }, [step, account, authorizeDelayMs, onConnect, onClose])

  return (
    <Modal title={`Connect ${integration.name}`} onClose={onClose} width="max-w-md">
      {step === 'consent' && (
        <div className="space-y-4">
          <div className="flex items-center justify-center gap-3 py-2">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-lg font-bold text-white">$</span>
            <span className="flex gap-1" aria-hidden>
              {[0, 1, 2].map((i) => <span key={i} className="h-1.5 w-1.5 rounded-full bg-slate-300" />)}
            </span>
            <IntegrationLogo id={id} size="lg" />
          </div>
          <p className="text-center text-sm text-slate-600">
            <span className="font-semibold text-slate-900">ExpenseTracker</span> wants to access your {integration.name} account
          </p>
          <Field label="Account">
            <input className={inputClass} value={account} onChange={(e) => setAccount(e.target.value)} />
          </Field>
          <ul className="space-y-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
            {integration.scopes.map((s) => (
              <li key={s} className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                {s}
              </li>
            ))}
          </ul>
          <p className="flex items-start gap-2 text-xs text-slate-500">
            <ShieldCheck className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
            <span>
              <DemoBadge className="mr-1" /> This is a simulated connection. No account is contacted and nothing leaves your device.
            </span>
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Cancel
            </button>
            <button type="button" onClick={() => setStep('authorizing')} className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
              Allow access
            </button>
          </div>
        </div>
      )}
      {step !== 'consent' && (
        <div className="flex flex-col items-center gap-3 py-8 text-center" aria-live="polite">
          {step === 'authorizing' ? (
            <>
              <LoaderCircle className="h-8 w-8 animate-spin text-indigo-600" aria-hidden />
              <p className="text-sm text-slate-600">Authorizing with {integration.name}…</p>
            </>
          ) : (
            <>
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
                <Check className="h-5 w-5 text-emerald-600" aria-hidden />
              </span>
              <p className="text-sm font-medium text-slate-900">Connected as {account}</p>
            </>
          )}
        </div>
      )}
    </Modal>
  )
}
