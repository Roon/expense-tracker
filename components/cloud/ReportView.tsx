// components/cloud/ReportView.tsx
import { formatCell } from '@/lib/cloud/format'
import type { Report, ReportTable } from '@/lib/cloud/types'

const numeric = new Set(['currency', 'percent', 'number', 'change'])

/** Renders any template's report. Used for in-hub previews and the public share page. */
export function ReportView({ report, maxRows = Infinity }: { report: Report; maxRows?: number }) {
  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {report.highlights.map((h) => (
          <div key={h.label} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
            <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{h.label}</dt>
            <dd className="mt-0.5 truncate text-base font-semibold text-slate-900">{h.value}</dd>
            {h.hint && <dd className="truncate text-xs text-slate-400" title={h.hint}>{h.hint}</dd>}
          </div>
        ))}
      </dl>
      {report.tables.map((t) => (
        <TableView key={t.id} table={t} maxRows={maxRows} />
      ))}
    </div>
  )
}

function TableView({ table, maxRows }: { table: ReportTable; maxRows: number }) {
  const rows = table.rows.slice(0, maxRows)
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold text-slate-700">{table.title}</h3>
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              {table.columns.map((c) => (
                <th key={c.key} className={`whitespace-nowrap px-3 py-2 font-medium ${numeric.has(c.format ?? '') ? 'text-right' : 'text-left'}`}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {rows.length === 0 && (
              <tr>
                <td colSpan={table.columns.length} className="px-3 py-6 text-center text-slate-400">
                  No expenses in this period
                </td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr key={i}>
                {table.columns.map((c) => (
                  <Cell key={c.key} value={r[c.key]} format={c.format} />
                ))}
              </tr>
            ))}
          </tbody>
          {table.footer && rows.length > 0 && (
            <tfoot className="border-t border-slate-200 bg-slate-50 font-semibold">
              <tr>
                {table.columns.map((c) => (
                  <Cell key={c.key} value={table.footer![c.key]} format={c.format} />
                ))}
              </tr>
            </tfoot>
          )}
        </table>
        {table.rows.length > rows.length && (
          <p className="border-t border-slate-100 bg-slate-50 px-3 py-1.5 text-center text-xs text-slate-500">
            +{table.rows.length - rows.length} more rows in the export
          </p>
        )}
      </div>
    </section>
  )
}

function Cell({ value, format }: { value: string | number | null | undefined; format?: ReportTable['columns'][number]['format'] }) {
  const text = formatCell(value, format)
  const tone =
    format === 'change' && typeof value === 'number' ? (value > 0 ? 'text-red-600' : value < 0 ? 'text-emerald-600' : '') : ''
  return (
    <td className={`whitespace-nowrap px-3 py-2 ${numeric.has(format ?? '') ? 'text-right tabular-nums' : ''} ${tone} ${format === 'text' || !format ? 'max-w-[18rem] truncate' : ''}`} title={text}>
      {text}
    </td>
  )
}
