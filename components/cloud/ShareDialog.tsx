// components/cloud/ShareDialog.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import { Check, Copy, ExternalLink, Link as LinkIcon, Lock, MessageSquareText, QrCode } from 'lucide-react'
import { reportToText } from '@/lib/cloud/format'
import { encodeShare, QR_MAX_URL_LENGTH, shareUrl } from '@/lib/cloud/share'
import { redactReport } from '@/lib/cloud/templates'
import type { Report } from '@/lib/cloud/types'
import { Modal } from './Modal'
import { Toggle, Field, inputClass } from './DestinationConfigEditor'

const EXPIRY_OPTIONS = [
  { id: 'never', label: 'Never', hours: null },
  { id: '1d', label: '24 hours', hours: 24 },
  { id: '7d', label: '7 days', hours: 24 * 7 },
  { id: '30d', label: '30 days', hours: 24 * 30 },
] as const

export function ShareDialog({
  report,
  onShared,
  onClose,
}: {
  report: Report
  /** Called once per link the user actually copies or opens, for history. */
  onShared: (url: string) => void
  onClose: () => void
}) {
  const hasItemized = report.tables.some((t) => t.itemized)
  const [summaryOnly, setSummaryOnly] = useState(hasItemized && report.templateId !== 'tax-report')
  const [hideDescriptions, setHideDescriptions] = useState(false)
  const [expiry, setExpiry] = useState<(typeof EXPIRY_OPTIONS)[number]['id']>('7d')
  const [url, setUrl] = useState('')
  const [qr, setQr] = useState<string | null>(null)
  const [copied, setCopied] = useState<'link' | 'text' | null>(null)
  const [recorded, setRecorded] = useState<string | null>(null)

  const shared = useMemo(() => redactReport(report, { summaryOnly, hideDescriptions }), [report, summaryOnly, hideDescriptions])

  useEffect(() => {
    let cancelled = false
    const hours = EXPIRY_OPTIONS.find((o) => o.id === expiry)!.hours
    const now = new Date()
    encodeShare({
      v: 1,
      report: shared,
      sharedAt: now.toISOString(),
      expiresAt: hours ? new Date(now.getTime() + hours * 3600_000).toISOString() : null,
    }).then(async (token) => {
      const link = shareUrl(window.location.origin, token)
      let qrSrc: string | null = null
      if (link.length <= QR_MAX_URL_LENGTH) {
        try {
          const svg = await QRCode.toString(link, { type: 'svg', errorCorrectionLevel: 'L', margin: 1 })
          qrSrc = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
        } catch {
          // Leave qrSrc null; the panel explains the QR is unavailable.
        }
      }
      if (cancelled) return
      setUrl(link)
      setQr(qrSrc)
    })
    return () => {
      cancelled = true
    }
  }, [shared, expiry])

  const record = () => {
    if (url && recorded !== url) {
      onShared(url)
      setRecorded(url)
    }
  }

  const copy = async (what: 'link' | 'text') => {
    try {
      await navigator.clipboard.writeText(what === 'link' ? url : reportToText(shared, url))
      setCopied(what)
      setTimeout(() => setCopied(null), 1800)
      record()
    } catch {
      // Clipboard can be blocked (permissions, insecure origin); the link stays selectable.
    }
  }

  const tooLongForQr = url.length > QR_MAX_URL_LENGTH

  return (
    <Modal
      title="Share report"
      subtitle={`${report.title} · ${report.periodLabel}`}
      onClose={onClose}
      width="max-w-2xl"
      icon={<span className="rounded-lg bg-indigo-50 p-2"><LinkIcon className="h-5 w-5 text-indigo-600" aria-hidden /></span>}
    >
      <div className="grid gap-5 sm:grid-cols-[1fr_200px]">
        <div className="space-y-4">
          <div className="flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-900">
            <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <p>
              <span className="font-semibold">Zero-upload sharing.</span> The report is compressed into the link itself, after the
              <code className="mx-0.5 rounded bg-emerald-100 px-1">#</code>, which browsers never send to a server. Anyone with the link can view it; no one else can.
            </p>
          </div>

          <div className="space-y-3">
            {hasItemized && (
              <Toggle
                checked={summaryOnly}
                onChange={setSummaryOnly}
                label="Summary only"
                description="Share totals and breakdowns, leave out individual transactions."
              />
            )}
            {hasItemized && !summaryOnly && (
              <Toggle
                checked={hideDescriptions}
                onChange={setHideDescriptions}
                label="Hide descriptions"
                description="Keep amounts and categories, mask what each purchase was."
              />
            )}
            <Field label="Link expires">
              <select className={inputClass} value={expiry} onChange={(e) => setExpiry(e.target.value as typeof expiry)}>
                {EXPIRY_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
            </Field>
          </div>

          <div>
            <div className="flex gap-2">
              <input readOnly value={url} aria-label="Share link" onFocus={(e) => e.target.select()} className={`${inputClass} font-mono text-xs`} />
              <button
                type="button"
                onClick={() => copy('link')}
                disabled={!url}
                className="flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {copied === 'link' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied === 'link' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-400">{url ? `${url.length.toLocaleString('en-US')} characters` : 'Encoding…'}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <a
              href={url || undefined}
              target="_blank"
              rel="noopener noreferrer"
              onClick={record}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <ExternalLink className="h-4 w-4" /> Open viewer
            </a>
            <button
              type="button"
              onClick={() => copy('text')}
              disabled={!url}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {copied === 'text' ? <Check className="h-4 w-4" /> : <MessageSquareText className="h-4 w-4" />}
              {copied === 'text' ? 'Copied' : 'Copy as message'}
            </button>
          </div>
        </div>

        <div className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
          <p className="flex items-center gap-1 self-start text-xs font-semibold uppercase tracking-wide text-slate-500">
            <QrCode className="h-3.5 w-3.5" aria-hidden /> Scan to open
          </p>
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="QR code for the share link" className="w-full rounded-lg bg-white" />
          ) : (
            <div className="flex aspect-square w-full items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white p-3 text-xs text-slate-500">
              {tooLongForQr ? (
                <span>
                  Too much data for a QR code.
                  {hasItemized && !summaryOnly && <> Turn on <span className="font-medium">Summary only</span> to shrink it.</>}
                </span>
              ) : url ? (
                'QR code unavailable.'
              ) : (
                'Generating…'
              )}
            </div>
          )}
          <p className="text-[11px] text-slate-400">Hand a phone the report in person.</p>
        </div>
      </div>
    </Modal>
  )
}
