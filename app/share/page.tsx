// app/share/page.tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Clock, Lock, TriangleAlert } from 'lucide-react'
import { ReportView } from '@/components/cloud/ReportView'
import { decodeShare, type DecodeResult } from '@/lib/cloud/share'

/** Public, read-only viewer for zero-upload share links. Data comes from the URL fragment. */
export default function SharedReportPage() {
  const [result, setResult] = useState<DecodeResult | null>(null)

  useEffect(() => {
    const load = () => {
      const token = window.location.hash.slice(1)
      if (!token) return setResult({ ok: false, error: 'This link has no report attached.' })
      decodeShare(token).then(setResult)
    }
    load()
    window.addEventListener('hashchange', load)
    return () => window.removeEventListener('hashchange', load)
  }, [])

  return (
    <div className="min-h-full bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-xs font-bold text-white">$</span>
            <span className="font-semibold tracking-tight text-slate-900">ExpenseTracker</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">Shared report</span>
          </div>
          <Link href="/" className="text-xs font-medium text-indigo-600 hover:text-indigo-700">Open the app →</Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        {!result && <div className="h-48 animate-pulse rounded-2xl bg-slate-200/60" />}
        {result && !result.ok && <Notice icon={TriangleAlert} title="Can't open this report" body={result.error} />}
        {result?.ok && result.expired && (
          <Notice
            icon={Clock}
            title="This link has expired"
            body={`The owner set it to expire on ${new Date(result.payload.expiresAt!).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}. Ask them for a new one.`}
          />
        )}
        {result?.ok && !result.expired && (
          <article>
            <div className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">{result.payload.report.periodLabel}</p>
              <h1 className="text-2xl font-bold text-slate-900">{result.payload.report.title}</h1>
              <p className="mt-1 text-sm text-slate-500">
                Shared {new Date(result.payload.sharedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                {result.payload.expiresAt &&
                  ` · expires ${new Date(result.payload.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
              </p>
            </div>
            <ReportView report={result.payload.report} />
            <p className="mt-8 flex items-center justify-center gap-1.5 text-center text-xs text-slate-400">
              <Lock className="h-3.5 w-3.5" aria-hidden /> This report is stored entirely in the link. No server has a copy.
            </p>
          </article>
        )}
      </main>
    </div>
  )
}

function Notice({ icon: Icon, title, body }: { icon: typeof Clock; title: string; body: string }) {
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center">
      <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-amber-50">
        <Icon className="h-5 w-5 text-amber-600" aria-hidden />
      </span>
      <h1 className="font-semibold text-slate-900">{title}</h1>
      <p className="mt-1 text-sm text-slate-500">{body}</p>
    </div>
  )
}
