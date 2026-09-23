import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CloudExportProvider } from '@/components/cloud/CloudExportProvider'
import ExportHubPage from '@/app/export/page'
import SharedReportPage from '@/app/share/page'
import { decodeShare } from '@/lib/cloud/share'
import type { Expense } from '@/lib/types'
import type { Schedule } from '@/lib/cloud/types'

// jsdom lacks the Encoding API that every browser ships; borrow Node's.
import { TextDecoder as NodeTextDecoder, TextEncoder as NodeTextEncoder } from 'util'
Object.assign(globalThis, { TextEncoder: NodeTextEncoder, TextDecoder: NodeTextDecoder })

jest.mock('@/lib/cloud/download', () => ({ downloadBlob: jest.fn() }))
const { downloadBlob } = jest.requireMock('@/lib/cloud/download') as { downloadBlob: jest.Mock }

const now = new Date()
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const monthSlug = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
const EXPENSES: Expense[] = [
  { id: '1', date: iso(now), amount: 42, category: 'Food', description: 'Team lunch' },
  { id: '2', date: iso(now), amount: 18, category: 'Transportation', description: 'Taxi' },
]

function seed(cloud?: object) {
  localStorage.clear()
  localStorage.setItem('expense-tracker-expenses', JSON.stringify(EXPENSES))
  if (cloud) localStorage.setItem('expense-tracker-cloud-v1', JSON.stringify(cloud))
}

function renderHub() {
  const user = userEvent.setup()
  render(
    <CloudExportProvider stageDelayMs={0}>
      <ExportHubPage />
    </CloudExportProvider>,
  )
  return user
}

const activity = () => screen.getByRole('tabpanel')

beforeEach(() => {
  jest.clearAllMocks()
  seed()
})

it('downloads a monthly summary and logs it in activity', async () => {
  const user = renderHub()
  await user.click(await screen.findByRole('button', { name: 'Download' }))
  await waitFor(() => expect(downloadBlob).toHaveBeenCalledTimes(1))
  expect(downloadBlob.mock.calls[0][1]).toBe(`monthly-summary-${monthSlug}.csv`)
  expect(await within(activity()).findByText(`Downloads/monthly-summary-${monthSlug}.csv · 2 records`, { exact: false })).toBeInTheDocument()
  expect(within(activity()).getByLabelText('Completed')).toBeInTheDocument()
})

it('previews the selected template', async () => {
  const user = renderHub()
  await user.click(await screen.findByRole('radio', { name: /Category Analysis/ }))
  const preview = screen.getByRole('region', { name: 'Preview' })
  expect(within(preview).getByText('Category Analysis')).toBeInTheDocument()
  expect(within(preview).getByText('Category breakdown')).toBeInTheDocument()
})

it('connects Dropbox through the consent flow, then saves a file there', async () => {
  const user = renderHub()
  await user.click(await screen.findByRole('radio', { name: /Dropbox/ }))
  await user.click(screen.getByRole('button', { name: 'Connect Dropbox' }))
  const dialog = screen.getByRole('dialog', { name: 'Connect Dropbox' })
  expect(within(dialog).getByText('Write to /Apps/ExpenseTracker')).toBeInTheDocument()
  await user.click(within(dialog).getByRole('button', { name: 'Allow access' }))
  expect(await screen.findByText(/Connected as demo.user@example.com/, {}, { timeout: 3000 })).toBeInTheDocument()
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument(), { timeout: 3000 })

  await user.click(screen.getByRole('button', { name: 'Save to Dropbox' }))
  expect(
    await within(activity()).findByText(`Dropbox: /Apps/ExpenseTracker/monthly-summary-${monthSlug}.csv`, { exact: false }),
  ).toBeInTheDocument()
  expect(downloadBlob).not.toHaveBeenCalled()
  expect(screen.getByText(/1 service connected · all synced/)).toBeInTheDocument()
})

it('validates email recipients before sending', async () => {
  const user = renderHub()
  await user.click(await screen.findByRole('radio', { name: /Email/ }))
  const send = screen.getByRole('button', { name: 'Send email' })
  expect(send).toBeDisabled()
  expect(screen.getByText('Add at least one recipient.')).toBeInTheDocument()

  const to = screen.getByLabelText('Recipients')
  await user.type(to, 'not-an-email{Enter}')
  expect(screen.getByText('One of the email addresses looks invalid.')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Remove not-an-email' }))
  await user.type(to, 'cpa@example.com{Enter}')
  expect(send).toBeEnabled()

  await user.click(screen.getByRole('tab', { name: /As it arrives in Email/ }))
  expect(screen.getByText('View full report')).toBeInTheDocument()

  await user.click(send)
  expect(await within(activity()).findByText(/cpa@example.com · 2 records/)).toBeInTheDocument()
})

it('creates a schedule with a preview of upcoming runs', async () => {
  const user = renderHub()
  await user.click(await screen.findByRole('button', { name: 'Schedule' }))
  const dialog = screen.getByRole('dialog', { name: 'Schedule recurring export' })
  expect(within(dialog).getByText('Next runs')).toBeInTheDocument()
  expect(within(dialog).getAllByRole('listitem')).toHaveLength(3)
  // Download isn't offered for unattended runs; email is the first available target.
  expect(within(dialog).getByRole('button', { name: 'Create schedule' })).toBeDisabled()
  await user.type(within(dialog).getByLabelText('Recipients'), 'me@example.com{Enter}')
  await user.click(within(dialog).getByRole('button', { name: 'Create schedule' }))

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(within(activity()).getByText('Monthly Summary → Email')).toBeInTheDocument()
  expect(within(activity()).getByText(/Monthly on the 1st at 8:00 AM/)).toBeInTheDocument()
})

it('runs overdue schedules on load and advances them', async () => {
  const overdue: Schedule = {
    id: 's1',
    name: 'Weekly backup',
    templateId: 'full-backup',
    destinationId: 'email',
    config: { kind: 'email', recipients: ['me@example.com'], subject: '', message: '', includeLink: false },
    frequency: 'weekly',
    weekday: 1,
    dayOfMonth: 1,
    time: '08:00',
    enabled: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    nextRunAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
    lastRunAt: null,
  }
  seed({ connections: {}, history: [], schedules: [overdue], syncTargets: [] })
  renderHub()
  expect(await within(activity()).findByText('Scheduled')).toBeInTheDocument()
  await waitFor(() => expect(within(activity()).getByLabelText('Completed')).toBeInTheDocument())

  const stored = JSON.parse(localStorage.getItem('expense-tracker-cloud-v1')!)
  expect(new Date(stored.schedules[0].nextRunAt).getTime()).toBeGreaterThan(Date.now())
  expect(stored.schedules[0].lastRunAt).not.toBeNull()
  // Several missed runs collapse into one catch-up run.
  expect(stored.history).toHaveLength(1)
})

it('marks jobs interrupted by a reload as failed', async () => {
  seed({
    connections: {},
    schedules: [],
    syncTargets: [],
    history: [{ id: 'j1', templateId: 'tax-report', period: { kind: 'year', year: 2026 }, destinationId: 'download', config: { kind: 'download', format: 'csv' }, trigger: 'manual', status: 'running', stage: 'Building CSV', progress: 45, createdAt: new Date().toISOString(), finishedAt: null, recordCount: 0, fileName: '', sizeBytes: 0, location: null }],
  })
  renderHub()
  expect(await within(activity()).findByText('The page was closed before this finished.')).toBeInTheDocument()
})

it('fails a job clearly when its service was disconnected', async () => {
  const s: Schedule = {
    id: 's2', name: 'Drive backup', templateId: 'full-backup', destinationId: 'google-drive',
    config: { kind: 'folder', folder: '/ET', format: 'json' }, frequency: 'daily', weekday: 0, dayOfMonth: 1, time: '08:00',
    enabled: true, createdAt: '2026-01-01T00:00:00.000Z', nextRunAt: new Date(Date.now() - 1000).toISOString(), lastRunAt: null,
  }
  seed({ connections: {}, history: [], schedules: [s], syncTargets: [] })
  renderHub()
  expect(await within(activity()).findByText('Google Drive is not connected. Connect it and retry.')).toBeInTheDocument()
})

it('creates a share link that decodes back to the report, with privacy options', async () => {
  // user-event installs a working clipboard stub on setup().
  const user = renderHub()
  await user.click(await screen.findByRole('radio', { name: /Tax Report/ }))
  await user.click(screen.getByRole('button', { name: 'Share link' }))
  const dialog = screen.getByRole('dialog', { name: 'Share report' })

  const input = within(dialog).getByLabelText('Share link') as HTMLInputElement
  await waitFor(() => expect(input.value).toContain('/share#'))
  let decoded = await decodeShare(input.value.split('#')[1])
  expect(decoded.ok && decoded.payload.report.tables.map((t) => t.id)).toEqual(['category-subtotals', 'by-month', 'ledger'])

  await user.click(within(dialog).getByRole('switch', { name: 'Summary only' }))
  await waitFor(async () => {
    decoded = await decodeShare(input.value.split('#')[1])
    expect(decoded.ok && decoded.payload.report.tables.map((t) => t.id)).toEqual(['category-subtotals', 'by-month'])
  })
  expect(within(dialog).getByAltText('QR code for the share link')).toBeInTheDocument()

  await user.click(within(dialog).getByRole('button', { name: 'Copy' }))
  expect(await navigator.clipboard.readText()).toBe(input.value)
  await user.keyboard('{Escape}')
  expect(within(activity()).getByText('Share link')).toBeInTheDocument()
})

describe('shared report page', () => {
  it('renders a report from the link fragment', async () => {
    const { encodeShare } = await import('@/lib/cloud/share')
    const { buildReport } = await import('@/lib/cloud/templates')
    const token = await encodeShare({
      v: 1,
      report: buildReport('category-analysis', EXPENSES, { kind: 'all' }),
      sharedAt: new Date().toISOString(),
      expiresAt: null,
    })
    window.history.replaceState(null, '', `/share#${token}`)
    render(<SharedReportPage />)
    expect(await screen.findByRole('heading', { name: 'Category Analysis' })).toBeInTheDocument()
    expect(screen.getByText('Category breakdown')).toBeInTheDocument()
    expect(screen.getByText(/No server has a copy/)).toBeInTheDocument()
  })

  it('explains a damaged link', async () => {
    window.history.replaceState(null, '', '/share#z.broken')
    render(<SharedReportPage />)
    expect(await screen.findByText("Can't open this report")).toBeInTheDocument()
  })

  it('refuses an expired link', async () => {
    const { encodeShare } = await import('@/lib/cloud/share')
    const { buildReport } = await import('@/lib/cloud/templates')
    const token = await encodeShare({
      v: 1,
      report: buildReport('full-backup', EXPENSES, { kind: 'all' }),
      sharedAt: '2020-01-01T00:00:00.000Z',
      expiresAt: '2020-01-02T00:00:00.000Z',
    })
    await act(async () => window.history.replaceState(null, '', `/share#${token}`))
    render(<SharedReportPage />)
    expect(await screen.findByText('This link has expired')).toBeInTheDocument()
  })
})

describe('live sync', () => {
  it('re-syncs linked sheets when expenses change', async () => {
    jest.useFakeTimers()
    const period = { kind: 'month', year: now.getFullYear(), month: now.getMonth() }
    seed({
      connections: { 'google-sheets': { destinationId: 'google-sheets', status: 'connected', account: 'a@b.co', connectedAt: now.toISOString(), lastSyncAt: null } },
      history: [],
      schedules: [],
      syncTargets: [{ id: 't1', templateId: 'monthly-summary', period, spreadsheetName: 'Budget', createdAt: now.toISOString(), lastSyncedAt: null }],
    })
    renderHub()
    await act(async () => jest.advanceTimersByTime(3100))
    const history = () => JSON.parse(localStorage.getItem('expense-tracker-cloud-v1')!).history
    expect(history()).toHaveLength(0) // no change, no sync

    localStorage.setItem('expense-tracker-expenses', JSON.stringify([...EXPENSES, { id: '9', date: iso(now), amount: 5, category: 'Food', description: 'Coffee' }]))
    // Bounded advance: recurring intervals mean "run all timers" would never finish.
    await act(async () => { await jest.advanceTimersByTimeAsync(3500) })

    expect(history()).toHaveLength(1)
    expect(history()[0]).toMatchObject({ trigger: 'sync', status: 'completed', recordCount: 3, location: 'Budget (Google Sheets)' })
    // Background syncs stay out of the activity tray.
    expect(screen.queryByLabelText('Export activity')).not.toBeInTheDocument()
    jest.useRealTimers()
  })
})
