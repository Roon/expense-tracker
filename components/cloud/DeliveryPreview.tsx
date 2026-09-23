// components/cloud/DeliveryPreview.tsx
import { formatCell, reportToText } from '@/lib/cloud/format'
import type { DestinationConfig, Report } from '@/lib/cloud/types'

/** Shows the report the way it will *arrive*: an email, a spreadsheet, a Slack post. */
export function DeliveryPreview({ report, config }: { report: Report; config: DestinationConfig }) {
  if (config.kind === 'email') return <EmailPreview report={report} config={config} />
  if (config.kind === 'sheet') return <SheetPreview report={report} name={config.spreadsheetName} />
  if (config.kind === 'channel') return <SlackPreview report={report} channel={config.channel} />
  return null
}

function EmailPreview({ report, config }: { report: Report; config: Extract<DestinationConfig, { kind: 'email' }> }) {
  const summary = report.tables.find((t) => !t.itemized)
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white text-sm shadow-sm">
      <div className="space-y-1 border-b border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-500">
        <p><span className="inline-block w-14 text-slate-400">From</span>ExpenseTracker &lt;reports@expensetracker.app&gt;</p>
        <p className="truncate"><span className="inline-block w-14 text-slate-400">To</span>{config.recipients.join(', ') || '—'}</p>
        <p className="truncate font-medium text-slate-800"><span className="inline-block w-14 font-normal text-slate-400">Subject</span>{config.subject || `${report.title} · ${report.periodLabel}`}</p>
      </div>
      <div className="space-y-4 px-5 py-5">
        {config.message && <p className="whitespace-pre-wrap text-slate-700">{config.message}</p>}
        <div className="rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 p-4 text-white">
          <p className="text-xs uppercase tracking-wide text-indigo-100">{report.periodLabel}</p>
          <p className="text-lg font-semibold">{report.title}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {report.highlights.slice(0, 4).map((h) => (
              <div key={h.label} className="rounded-lg bg-white/10 px-2.5 py-1.5">
                <p className="text-[10px] uppercase tracking-wide text-indigo-100">{h.label}</p>
                <p className="truncate font-semibold">{h.value}</p>
              </div>
            ))}
          </div>
        </div>
        {summary && (
          <table className="w-full text-xs">
            <tbody className="divide-y divide-slate-100">
              {summary.rows.slice(0, 6).map((r, i) => (
                <tr key={i}>
                  <td className="py-1.5 text-slate-600">{formatCell(r[summary.columns[0].key])}</td>
                  <td className="py-1.5 text-right font-medium tabular-nums text-slate-900">
                    {formatCell(r[summary.columns.find((c) => c.format === 'currency')?.key ?? ''], 'currency')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {config.includeLink && <span className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white">View full report</span>}
          <span className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600">📎 {report.templateId}.csv</span>
        </div>
      </div>
    </div>
  )
}

function SheetPreview({ report, name }: { report: Report; name: string }) {
  const table = report.tables[0]
  const cols = table ? table.columns : []
  const letters = 'ABCDEFGH'
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white text-xs shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
        <span className="flex h-6 w-5 items-center justify-center rounded-sm bg-emerald-600 text-[10px] font-bold text-white">S</span>
        <span className="truncate font-medium text-slate-800">{name || 'Untitled spreadsheet'}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse font-mono">
          <thead>
            <tr className="bg-slate-50 text-slate-400">
              <th className="w-8 border border-slate-200" />
              {cols.map((_, i) => (
                <th key={i} className="border border-slate-200 px-2 py-0.5 font-normal">{letters[i]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-slate-200 bg-slate-50 text-center text-slate-400">1</td>
              {cols.map((c) => (
                <td key={c.key} className="whitespace-nowrap border border-slate-200 bg-emerald-50 px-2 py-1 font-semibold text-emerald-900">{c.label}</td>
              ))}
            </tr>
            {table?.rows.slice(0, 6).map((r, i) => (
              <tr key={i}>
                <td className="border border-slate-200 bg-slate-50 text-center text-slate-400">{i + 2}</td>
                {cols.map((c) => (
                  <td key={c.key} className={`max-w-[10rem] truncate whitespace-nowrap border border-slate-200 px-2 py-1 text-slate-700 ${c.format && c.format !== 'text' && c.format !== 'date' ? 'text-right' : ''}`}>
                    {formatCell(r[c.key], c.format)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-0.5 overflow-x-auto border-t border-slate-200 bg-slate-50 px-2 pt-1">
        {report.tables.map((t, i) => (
          <span key={t.id} className={`whitespace-nowrap rounded-t-md px-3 py-1 ${i === 0 ? 'bg-white font-medium text-emerald-700 shadow-sm' : 'text-slate-500'}`}>
            {t.title}
          </span>
        ))}
      </div>
    </div>
  )
}

function SlackPreview({ report, channel }: { report: Report; channel: string }) {
  const [first, ...rest] = reportToText(report).split('\n')
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
      <p className="mb-3 text-xs font-medium text-slate-500">{channel}</p>
      <div className="flex gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">$</span>
        <div className="min-w-0">
          <p className="text-sm"><span className="font-bold text-slate-900">ExpenseTracker</span> <span className="rounded bg-slate-100 px-1 text-[10px] font-semibold text-slate-500">APP</span></p>
          <p className="font-semibold text-slate-900">{first.replace(/\*/g, '')}</p>
          <pre className="mt-1 whitespace-pre-wrap font-sans text-slate-700">{rest.join('\n').trim()}</pre>
        </div>
      </div>
    </div>
  )
}
