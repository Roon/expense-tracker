# Data Export: Code Analysis of Three Implementations

**Date:** 2026-09-23
**Base:** `main` @ `50ea697`
**Branches analyzed:**

| Version | Branch | Commit | Concept |
|---|---|---|---|
| V1 | `feature-data-export-v1` | `64abdf2` (since refactored, see §3 update) | One button, CSV download |
| V2 | `feature-data-export-v2` | `73c5a21` | Advanced local export dialog (CSV/JSON/PDF, filters, preview) |
| V3 | `feature-data-export-v3` | `fb8de86` | Cloud-style Export Hub (templates, destinations, jobs, schedules, share links) |

## Method

For each branch I checked it out, ran `npm install` so `node_modules` matched that branch's lockfile, then ran the full Jest suite and a production `next build`. I read every file in `git diff main..<branch>`. Where this document makes a behavioral claim about a bug, it was verified by running code, not inferred. Those claims are marked **(verified)**.

---

## 1. At a glance

| | V1 | V2 | V3 |
|---|---|---|---|
| Files changed (excluding lockfile) | 3 | 20 (18 new) | 30 (25 new) |
| Lines added / removed | +27 / −12 | +1,587 / −7 | +3,727 / −55 |
| Production lines added (excluding tests) | ~20 | ~1,186 | ~3,223 |
| New runtime dependencies | none | `jspdf`, `jspdf-autotable` | `qrcode` (+ `@types/qrcode` dev) |
| Tests added | 1 (27 total) | 42 (68 total) | 45 (71 total) |
| Test suites passing | 3/3 | 6/6 | 5/5 |
| Dashboard `/` page JS | 4.63 kB | **12.1 kB** | 4.52 kB |
| Other routes | none | none | `/export` 25.9 kB, `/share` 4.87 kB |
| Lazy-loaded code | none | ~362 KB uncompressed (jsPDF), loaded only when a PDF is exported | none |
| Output formats | CSV | CSV, JSON, PDF | CSV, JSON (downloads). Cloud targets simulated |
| Filtering | none (all expenses) | Date range + presets, categories | Template + period (month / year / all) |
| Entry point | Button on dashboard | Button → modal dialog | Dedicated page, nav item, dashboard link |
| Real vs simulated | All real | All real | Downloads, share links, QR codes, schedules, history are real. Email, Sheets, Drive, Dropbox, OneDrive and Slack are simulated |

Baseline on `main`: the dashboard is 4.5 kB and there are 26 tests. `main` already has an "Export CSV" button on the Expenses page, backed by `lib/csvExport.ts`.

---

## 2. Cross-cutting finding: the existing CSV exporter produces malformed files (verified)

`lib/csvExport.ts` exists on `main` and is still used by the Expenses page on **all three branches**. It writes the Date column with `formatDate()`, which returns strings like `Jan 15, 2024`. That value is **not quoted**, so the comma inside it splits one field into two.

Output of V1's `generateCSV`, captured on the V1 branch:

```
Date,Category,Amount,Description
Jan 15, 2024,Food,25.50,Lunch            ← 5 fields under a 4-column header
```

Field count per line: `[4, 5, 5, 5]`. Any spreadsheet or parser shifts every column one place right. The existing tests check the header, row count, amounts and quoting of descriptions, but never the Date column, so the bug has gone unnoticed.

- **V1** ships this exporter as its feature, so V1's output is malformed.
- **V2 and V3** don't use it for their own features (both write ISO `YYYY-MM-DD` dates). But they leave `lib/csvExport.ts` in place for the Expenses page, so the app ends up with **two CSV writers, one of them broken**.

**Recommendation, whichever version is adopted:** fix or retire `lib/csvExport.ts`. Use ISO dates or quote the field, and add a test that parses the output and checks the field count.

> **Update:** fixed on branch `fix/csv-export-date-column` (commit `6866980`). The date field is now quoted, and tests parse the output to check field counts. It's now on every branch: fast-forwarded into `main`, and merged into `feature-data-export-v1` (`5c4f477`), `feature-data-export-v2` (`87ced9f`) and `feature-data-export-v3` (`a5ff961`). The Expenses page export no longer splits the date on any branch.

---

## 3. V1: Simple CSV export

> **Update: SOLID refactor (commit `a6d4fb1`).** After this analysis, V1 was restructured around the SOLID principles. What users see is unchanged: tests that pin the exact CSV bytes, file type, filename and URL cleanup passed before and after, and both buttons were checked in a real browser. The rest of this section describes V1 as it was at `64abdf2`. What changed since:
>
> - **Structure:** `lib/csvExport.ts` is gone. A new `lib/exporting/` has one job per module:
>   - `expenseColumns.ts`: which columns exist, as a list of `{ header, value }`
>   - `csv.ts`: a CSV writer that works for any item type
>   - `browserFileSaver.ts`: how the file reaches the user
>   - `exporter.ts`: joins a format to a delivery method
>   - `index.ts`: the one place concrete pieces are chosen
>
>   The button is its own component, `components/ExportDataButton.tsx`, and accepts a substitute exporter. The Expenses page uses `lib/exporting` directly.
> - **Small interfaces:** `Serializer`, `FileSaver` and `Exporter`. Adding a column means adding to the list, and a new format is a new `Serializer`; neither touches existing code.
> - **Escaping:** every cell now goes through the escaping function, headers included. That rules out the kind of bug that caused the unquoted date, where one column forgot to escape.
> - **Tests:** 44 in total, up from 29. The additions are characterization tests, unit tests for each module using in-memory fakes, and a test for the button.
> - **Size:** about 100 lines across six small modules, up from about 30 in one file. The dashboard bundle is 4.83 kB, up from 4.63 kB.
> - **Still open, deliberately:** formulas in descriptions aren't blocked, and there's no UTF-8 BOM. Fixing either would change the output, so they were out of scope for a behaviour-preserving refactor. On V1 they now live in `lib/exporting/csv.ts` and `browserFileSaver.ts`, not in `lib/csvExport.ts` as issues #3 and #11 in §7 say. Each is now a small, isolated change.
> - **Effect on the recommendation (§8):** V1's new `Serializer`/`FileSaver` contracts are a lighter-weight alternative to V2's format registry as the base to build on.

### Files created / modified

| File | Change |
|---|---|
| `app/page.tsx` | Adds an "Export Data" `<button>` next to "Add Expense" in the dashboard header |
| `lib/csvExport.ts` | Reorders columns to `Date, Category, Amount, Description` |
| `__tests__/csvExport.test.ts` | Updates header assertions and adds a row-order test |

### Architecture overview

No new modules. The dashboard calls the existing `downloadCSV(expenses)` directly from an inline `onClick`. There are two pieces:

1. `generateCSV(expenses) → string`, a pure function
2. `downloadCSV(expenses, filename)`, which is the side-effecting part: it builds a Blob, creates an object URL and clicks an anchor.

### Key components

- **`DashboardPage`**: owns the button. Uses `expenses` from `useExpenses()`.
- **`generateCSV` / `escapeCSVField` / `downloadCSV`**: formatting and download. These already existed.

### Libraries

None added. Uses only browser APIs: `Blob`, `URL.createObjectURL`, `HTMLAnchorElement.download`.

### Patterns and approach

It reuses what exists and adds almost nothing. There's no feedback state: the Expenses page's button shows "Exported!", but the dashboard's doesn't.

### Complexity

Trivial. About 20 production lines, and cyclomatic complexity of about 1 in the new code.

### Error handling

- There's no `try/catch`. In practice the only failure modes are browser-level: download blocked, or out of memory on huge data.
- The button only renders in the populated dashboard branch. The empty state renders `EmptyState` instead, so exporting zero rows can't happen from the dashboard.

### Security

- **CSV formula injection is not mitigated (verified).** A description like `=HYPERLINK("http://x")` is written verbatim and runs as a formula when opened in Excel or Sheets. This is a real risk if expense descriptions can ever come from another person, for example through shared or imported data.
- No XSS surface (no `dangerouslySetInnerHTML`). No data leaves the device.

### Performance

- Synchronous string building on the main thread, O(n). This is fine for the thousands of rows a personal tracker holds.
- `URL.revokeObjectURL` is called straight after `a.click()`. That's generally fine in modern browsers, but older Safari versions have been known to cancel the download when the URL is revoked this early.
- No bundle impact (+0.1 kB).

### Extensibility and maintainability

Easy to read, and there's little to maintain. But there's no seam for adding formats or filters: every new capability means editing `csvExport.ts` and the dashboard directly.

### Side effect

Reordering the columns also changes the **Expenses page** export, since both share `csvExport.ts`. This was deliberate, for consistency, but it's a behavior change outside the dashboard.

### Technical deep dive

- **How export works:** click → `downloadCSV(expenses)` → `generateCSV` → `Blob('text/csv')` → object URL → a temporary `<a download="expenses.csv">` is clicked.
- **File generation:** string concatenation. Descriptions are quoted when they contain `,` `"` or `\n`, but `\r` isn't handled. There's **no UTF-8 BOM**, so Excel on Windows can garble non-ASCII text (e.g. `Café`). Dates are human-formatted and unquoted, which is the bug described in §2.
- **User interaction:** a single click with no confirmation, progress or success feedback.
- **State management:** none. It reads the `useExpenses()` state.
- **Edge cases:** empty data is avoided by the UI. Commas in dates break the CSV. Formula injection and encoding aren't handled. The filename is always `expenses.csv`.

---

## 4. V2: Advanced local export dialog

### Files created / modified

| Area | Files |
|---|---|
| Domain library (new) | `lib/export/types.ts`, `filters.ts`, `filename.ts`, `download.ts`, `index.ts`, `formats/csv.ts`, `formats/json.ts`, `formats/pdf.ts` |
| State (new) | `hooks/useExportOptions.ts` |
| UI (new) | `components/export/ExportButton.tsx`, `ExportDialog.tsx`, `FormatPicker.tsx`, `DateRangeFields.tsx`, `CategoryFilter.tsx`, `ExportPreview.tsx` |
| Modified | `app/page.tsx` (mounts `ExportButton`), `package.json` (jsPDF deps) |
| Tests (new) | `__tests__/exportLib.test.ts` (node env), `useExportOptions.test.ts`, `ExportDialog.test.tsx` |

### Architecture overview

Three clean layers:

```
components/export/*   presentational + dialog orchestration
        │
hooks/useExportOptions   useReducer form state → derived {selected, summary, validationError}
        │
lib/export/*          pure domain: filter → summarize → serialize (format registry) → download
```

`lib/export` has no React dependency and is unit-tested in a Node environment. Formats sit behind a registry, `EXPORT_FORMATS: Record<ExportFormat, ExportFormatDefinition>`, where each entry supplies `serialize(payload) → Promise<Blob>`. The dialog calls one function, `exportExpenses(expenses, options)`, and gets back `{ blob, filename, count }`.

### Key components

| Component | Responsibility |
|---|---|
| `ExportButton` | Trigger. Mounts the dialog only while open, so each session starts from the defaults |
| `ExportDialog` | Orchestration: status machine (`idle / exporting / success / error`), focus trap, Escape, focus restore, auto-close after success, per-category counts |
| `FormatPicker` | ARIA radiogroup of format cards |
| `DateRangeFields` | Preset chips and native `<input type="date">` with `min`/`max` cross-constraints |
| `CategoryFilter` | Visually-hidden checkboxes styled as chips, per-category counts, select all / clear |
| `ExportPreview` | Stat tiles, category-mix bar, and a table capped at 100 rows (the export itself isn't capped) |
| `useExportOptions` | Reducer (`setFormat`, `applyPreset`, `setStartDate`, `toggleCategory`, …). Derives filtered rows, summary and validation with `useMemo` |
| `lib/export/filters` | Inclusive ISO-date filtering, summary with cent rounding, date-preset resolution (handles year boundaries) |
| `lib/export/filename` | Strips illegal characters, drops an extension the user typed, caps length at 100, falls back to a dated default |
| `formats/csv` | RFC 4180 CRLF, UTF-8 BOM, quoting, formula-injection guard |
| `formats/json` | `{ exportedAt, filters, summary, expenses[] }`, keeping only known fields |
| `formats/pdf` | jsPDF + autotable report: title, summary tiles, paginated table, repeated header, total footer, "Page x of y" |

### Libraries

- **`jspdf` ^4.2.1 and `jspdf-autotable` ^5.0.8.** Both are dynamically imported inside `serializePDF`, so they build as separate chunks (~362 KB uncompressed) and are fetched only on the first PDF export.
- Everything else uses platform APIs.

### Patterns and approach

- Registry / strategy pattern for formats
- Reducer plus derived state (no duplicated state; the preview and summary are computed)
- Discriminated-union status for the export lifecycle
- Pure core with a thin UI shell; the UI is composed from small presentational components
- A lazy import tied to the feature that needs it

### Complexity

Moderate. About 1,190 production lines. `ExportDialog.tsx` (335 lines) is the one dense file. It combines keyboard and focus management, the status machine and layout, and could be split: for example, extract a reusable `Modal` like the one V3 has.

### Error handling

- **Validation before export:** at least one category, and start date ≤ end date. The Export button is disabled with an inline reason. Zero matching rows disables export, and the preview explains why.
- **Runtime errors:** `try/catch` around `exportExpenses`. It logs with `console.error`, shows a friendly error with `role="alert"` and allows retry.
- **Busy lock:** while exporting, all inputs, Cancel, Escape and backdrop clicks are disabled, which prevents double submission.
- **Filename:** a name that's empty after sanitizing falls back to `expenses-YYYY-MM-DD`.
- **Gap:** the error message is generic and the root cause is only in the console.
- **Minor dead code:** `document.body.style.overflow = 'hidden'` has no effect, because the app scrolls inside `<main className="overflow-auto">` (in `AppShell`), not the body. It's harmless, because the fixed overlay already stops interaction with the page behind.

### Security

- Formula injection is neutralized in the CSV (`'` prefix on `= + - @ \t \r`).
- JSON output lists fields explicitly, so any extra properties on stored objects aren't leaked.
- Filenames are sanitized, though Windows reserved names like `CON` or `NUL` aren't handled. That's harmless, because browsers rename those downloads.
- Everything happens on the device. No XSS surface.

### Performance

- **Bundle cost on the dashboard: +7.5 kB.** `ExportButton` statically imports the dialog, the preview and the whole `lib/export` layer, even though the dialog only mounts on click. Wrapping `ExportDialog` in `next/dynamic` would bring the dashboard back to baseline.
- Filtering is recomputed per keystroke with `useMemo`, O(n). Negligible at personal-finance scale.
- The preview renders at most 100 rows, so a large dataset doesn't slow the modal down.
- PDF generation runs on the main thread. For thousands of rows it could freeze the UI for a moment. The spinner appears before the work starts, but a Web Worker would be the next step if that matters.

### Extensibility and maintainability

- **Strong.** Adding a format is one file plus one registry entry, and serializers receive a uniform `ExportPayload`.
- The filters live in their own module and can be reused (e.g. by the Expenses page).
- There's good unit coverage of the core: presets, including year boundaries; filename rules; CSV escaping; JSON shape; a multi-page PDF. Component tests cover the whole dialog flow, including loading, error, focus trap and Escape.
- **Known limitation:** jsPDF's built-in Helvetica can't render characters outside Latin-1 (emoji, CJK scripts). Supporting them means embedding a font, which adds size.

### Technical deep dive

- **How export works:** `ExportDialog.handleExport` → `exportExpenses(expenses, options)` → `applyExportFilters` → `summarizeExpenses` → `EXPORT_FORMATS[format].serialize(payload)` → `buildFilename` → `downloadBlob`. The anchor is appended to the DOM and the object URL is revoked on the next tick.
- **File generation:**
  - CSV: string building with ISO dates and a BOM.
  - JSON: `JSON.stringify(doc, null, 2)`.
  - PDF: an imperative jsPDF drawing API plus autotable for the paginated grid. Page footers are drawn in a second pass once the total page count is known.
- **User interaction:** modal-first. Choose options, see a live preview and summary, then export. The button label includes the record count ("Export 12 records"), and there are spinner, success (auto-close after 1.5 s) and error-with-retry states. Keyboard: Escape, a Tab trap, and focus restored to the trigger.
- **State management:** local `useReducer` in `useExportOptions`, with derived memoized selectors and a separate `useState` status machine. No global state.
- **Edge cases:** invalid date ranges; no categories; zero matches; single-day ranges (inclusive bounds); Last Month in January; floating-point drift in totals (0.1 + 0.2); commas, quotes and newlines in descriptions; formula injection; typed extensions and illegal filename characters; previews over 100 rows; multi-page PDFs.

---

## 5. V3: Cloud-integrated Export Hub

### Files created / modified

| Area | Files |
|---|---|
| Domain library (new) | `lib/cloud/types.ts`, `templates.ts`, `period.ts`, `format.ts`, `share.ts`, `schedule.ts`, `integrations.ts`, `store.ts`, `download.ts` |
| Runtime (new) | `components/cloud/CloudExportProvider.tsx` (context, reducer, job runner, scheduler, live sync), `JobTray.tsx` |
| UI (new) | `app/export/page.tsx` (hub), `app/share/page.tsx` (public viewer), `components/cloud/Composer.tsx`, `DestinationConfigEditor.tsx`, `DeliveryPreview.tsx`, `ReportView.tsx`, `ConnectDialog.tsx`, `ShareDialog.tsx`, `ScheduleDialog.tsx`, `HubPanels.tsx`, `IntegrationLogo.tsx`, `Modal.tsx` |
| Modified | `components/AppShell.tsx` (wraps the app in the provider, adds an Export nav item, hides the app's navigation on `/share`); `hooks/useExpenses.ts` (exports `STORAGE_KEY` and `loadFromStorage`, and **memoizes the sorted array**); `app/page.tsx` (dashboard link); `tailwind.config.ts` (adds `lib/**` to `content`); `package.json` |
| Tests (new) | `__tests__/cloudLib.test.ts` (node env, 32 tests), `ExportHub.test.tsx` (13 integration tests) |

### Architecture overview

```
app/export (hub page) ──┐          app/share (public viewer, no app navigation)
components/cloud/* UI ──┤                    │
                        ▼                    ▼
        CloudExportProvider (mounted in AppShell, active on every page)
          ├─ useReducer: connections, history (≤50), schedules, syncTargets
          ├─ persistence effect → localStorage 'expense-tracker-cloud-v1'
          ├─ job runner: staged async pipeline with simulated latency
          ├─ scheduler: setInterval 20 s, runs whatever is due
          ├─ live-sync watcher: setInterval 3 s, compares expenses storage string
          └─ JobTray (portal-like fixed overlay)
                        │
        lib/cloud/* pure domain
          templates (Report model) → format (CSV/JSON/text) → share (deflate + base64url)
          schedule (next-run math) · period · integrations catalog · store
```

The central abstraction is the **`Report`** model: highlights plus typed tables, with a `CellFormat` per column. All four templates produce a `Report`. Every consumer renders or serializes that same model: the hub preview, the email/sheet/Slack previews, CSV, JSON, the text digest, share links and the public viewer.

### Key components

| Component | Responsibility |
|---|---|
| `CloudExportProvider` | Global export runtime and context API (`runExport`, `retryJob`, `connect`, `addSchedule`, `toggleSchedule`, `runScheduleNow`, `recordShare`, …). Hydrates from and persists to localStorage, and marks jobs interrupted by a reload as failed |
| `JobTray` | Bottom-right activity toasts on every page, with progress bar, retry and auto-dismiss (6 s) |
| `ExportHubPage` | Composer: template gallery, period picker, destination grid, per-destination config drafts, preview with an "as it arrives" tab. Plus the Activity / Schedules / Connected apps tabs |
| `templates.ts` | Four report builders (Monthly Summary vs previous month, Tax Report, Category Analysis, Full Backup) and `redactReport` for privacy |
| `share.ts` | Encodes a `SharePayload` as `z.<base64url(deflate(json))>`, with a `j.` uncompressed fallback. Decodes and checks expiry |
| `SharedReportPage` | Reads `location.hash`, decodes and renders `ReportView`, with notices for expired or damaged links |
| `ShareDialog` | Privacy toggles (summary only, hide descriptions), expiry, copy, open, copy as message, SVG QR code (only when the URL is ≤ 2,300 characters) |
| `ScheduleDialog` | Frequency, weekday or day of month, time; a preview of the next three runs; excludes "download" as an unattended target |
| `ConnectDialog` | Simulated OAuth consent (scopes, account, authorizing and connected states) |
| `DestinationConfigEditor` | Discriminated-union editor: recipient chips for email, sheet name and live sync, folder and format, channel |
| `DeliveryPreview` | Rendered email, a spreadsheet grid with tabs, a Slack message |
| `integrations.ts` | Catalog of seven destinations (metadata, scopes, default config, labels), `validateConfig`, `describeLocation` |

### Libraries

- **`qrcode` ^1.5.4.** Imported statically in `ShareDialog`, so it's part of the 25.9 kB `/export` chunk. Uses SVG output, so no canvas is needed.
- Platform APIs: `CompressionStream` / `DecompressionStream` (deflate), `TextEncoder`, `btoa`/`atob`, the Clipboard API, `crypto.randomUUID`.

### Patterns and approach

- App-wide context plus reducer, a **service-layer-in-a-provider**
- Discriminated unions throughout (`DestinationConfig`, `Period`, job status)
- Registry and catalog patterns (templates, integrations)
- One canonical intermediate representation (`Report`) with many renderers
- Background-job model with staged progress, persistent history, and retry that reuses the stored request
- Offline-first scheduling: runs are computed and fired on the client, and missed runs collapse into one catch-up
- Polling to detect changes (localStorage has no same-tab change event)

### Complexity

**High.** About 3,220 production lines across 25 new files.

- **Hotspot:** `CloudExportProvider.tsx` (395 lines). It combines state, persistence, the job runner, the scheduler, live sync and the public API. It should be split into `useJobRunner`, `useScheduler` and `useLiveSync` hooks.
- **`templates.ts` (316 lines)** is long but regular: four builders of similar shape.

### Error handling

- **Per-destination validation** (`validateConfig`): email syntax, folder path, channel format, sheet name. Invalid chips are highlighted, and the primary button is disabled with a reason.
- **Job failures:** caught in `execute`, marked `failed` with a message (e.g. "Google Drive is not connected. Connect it and retry."), shown in both the tray and the history, and retryable.
- **Reload resilience:** `loadCloudState` turns `queued`/`running` jobs into `failed` ("The page was closed before this finished.").
- **Storage:** reads and writes are wrapped in `try/catch`, and the hub keeps working for the session if storage is full.
- **Share decoding:** bad scheme, truncated data, invalid base64 or deflate, unsupported version and expiry all lead to specific, user-friendly notices.
- **Gaps:**
  - **Clipboard failures are silent**: the `catch` does nothing, and the user gets no feedback.
  - **The `'error'` connection status is dead code**: it's defined and rendered, but nothing ever sets it (verified by grep).
  - **Share payload validation is shallow**: it only checks `v === 1` and that `report.tables` exists. A crafted link whose tables lack `columns` would throw during render. The root `app/error.tsx` boundary would catch that, but the message would be generic.

### Security

- **Simulated integrations:** they're clearly labelled "Demo" and never touch the network. But **if shipped to real users**, "Delivered" and "Uploaded to Dropbox" statuses for work that never happened would mislead them. They must be removed, feature-flagged or replaced with real integrations before production. Real OAuth tokens also can't be kept in localStorage safely, so real integrations need a backend.
- **Share links:**
  - The data travels inside the URL fragment, which browsers don't send in HTTP requests, so the app's own host never receives it.
  - **But the full link text does persist** wherever it's pasted or stored: chat and email providers, browser history, synced bookmarks. The viewer's footer says "No server has a copy". That's accurate for the app's host but overstates things in general, and should be reworded (e.g. "ExpenseTracker's servers never receive this data").
  - **Expiry is advisory.** It's enforced by the viewer page only; anyone who decodes the token by hand can read expired data. The dialog correctly says "anyone with the link can view it".
  - **Decompression bomb.** There's no cap on decompressed size. A maliciously crafted link could make the viewer inflate a large payload and hang the tab. The risk is low (it only affects the person opening a hostile link), and the fix is simple: stop decompressing after a byte limit.
  - **Privacy controls:** summary-only removes itemized tables (for a Full Backup that means highlights only, so nothing itemized leaks). Hide-descriptions masks the text.
- **XSS:** all decoded content is rendered as React text nodes. There's no `dangerouslySetInnerHTML` on any branch (verified), and the QR code is an `<img>` with an SVG data URI generated locally.
- **CSV:** formula-injection guard, same as V2.
- **Personal data at rest:** email recipients, account names and share URLs (which contain report data) are stored in localStorage history. Acceptable for a single-user local app, but worth noting.

### Performance

- **Always-on background work on every page:**
  - A 3 s interval reads and compares the whole expenses JSON string: O(data size) every 3 s, cheap at this scale.
  - A 20 s scheduler tick.
  - 30 s relative-time tickers while the hub panels are mounted.
- **Artificial latency:** local downloads take ~1.3 s (`stageDelayMs = 650`, with multipliers 0.6 + 1 + 0.4) and "cloud" jobs ~1.95 s. This is deliberate theatre for the demo, but it's pure delay for the one real destination, downloads.
- **Bundle:** the dashboard is unaffected (4.52 kB). `/export` is 25.9 kB including `qrcode`, which could be lazy-loaded when the Share dialog opens.
- **Re-render fix:** `useExpenses` used to return a newly sorted array on every render, which broke memoization everywhere downstream. It's now memoized, which benefits every consumer. The bug was found because it made share links regenerate after unrelated re-renders.
- Share-link generation compresses the report on each option change. It's async and the reports are small, so there's no measurable cost.

### Extensibility and maintainability

- **Strong domain seams:**
  - A new template is one builder that returns a `Report`; every renderer, serializer and share link works automatically.
  - A new destination is a catalog entry, a config variant and a preview, although `execute()` has destination-specific branches to extend.
- **Real integrations would be a rewrite of the delivery layer, not an extension.** A server-side job queue, OAuth token storage, webhooks and retries would replace the in-provider runner. The UI and the `lib/cloud` domain would carry over largely as they are.
- **Coupling:**
  - The job runner reads expenses straight from localStorage through the exported `loadFromStorage` / `STORAGE_KEY`, bypassing the `useExpenses` hook. It's pragmatic, because jobs need fresh data outside React render, but it ties export to the storage format.
  - `recordShare` borrows `destinationId: 'download'` as a placeholder, which is a small modelling smell (share isn't a destination).
- **Tests:** the pure library is well covered: templates with exact figures, CSV and text formats, share round-trip, compression ratio, expiry and damaged links, next-run calculation across week, month and year boundaries, relative periods, validation. The integration tests cover the main user flows end to end, including the consent flow, overdue schedule catch-up, interrupted-job recovery, disconnected-service failure, share link decode with privacy options, and live sync.
- **Tailwind config change:** `lib/**` had to be added to `content`, because class names live in the integrations catalog and template metadata. Keeping styling in `lib` is a maintainability smell. A component-level map from ID to class would be cleaner.

### Technical deep dive

- **How export works:**
  1. `runExport(req)` adds a `queued` job to history and calls `execute(job)`.
  2. `execute` checks the connection, sets the stage to *Collecting* (15%) and calls `loadFromStorage()`.
  3. `buildReport(template, expenses, period)`.
  4. *Building* (45%): `serializeReport(report, format)`.
  5. *Delivering* (80%): cloud destinations flip the connection to `syncing`.
  6. Download destinations call `downloadBlob`. Sheet destinations with live sync upsert a `SyncTarget`.
  7. `completed`, with `location` set (e.g. `Dropbox: /Apps/ExpenseTracker/monthly-summary-2026-09.csv`).
- **File generation:**
  - CSV has multiple sections: a title block, then each table with its own header, then a footer total. Values are raw (ISO dates, plain numbers, percentages as numbers), with a BOM and the formula guard.
  - JSON is the `Report`, plus the raw `expenses[]` for Full Backup so it can be restored.
  - A plain-text digest for Slack and messages.
  - Share links: `JSON → TextEncoder → CompressionStream('deflate') → base64url`, placed in the URL fragment.
- **User interaction:** a page-level composer rather than a modal. Pick a template, then a period and destination, then configure it, then send, share or schedule. Results show up in a toast tray on every page and in an Activity log. Sub-flows run in modals (consent, share, schedule) with a shared accessible `Modal` (focus trap, Escape, focus restore).
- **State management:**
  - **Global:** a React context plus `useReducer` in `CloudExportProvider`, persisted to localStorage on every change and hydrated on mount. A `stateRef` gives async jobs the latest state without stale closures.
  - **Page-local:** `useState` for the composer, including per-destination config drafts so switching tiles keeps what you typed.
- **Edge cases:**
  - Empty periods (every template builds without `NaN`).
  - January compared with the previous December.
  - The daily average uses days elapsed for the current month.
  - Categories present only in the previous month.
  - Floating-point rounding.
  - Missed schedule runs collapse into one; re-enabling a paused schedule recomputes from now rather than firing stale runs.
  - Monthly day capped at 28.
  - DST handled by local-time `Date` construction.
  - Interrupted jobs; a disconnected service during a scheduled run.
  - Sharing a Full Backup "summary only" leaks nothing itemized.
  - The QR code only appears when the link fits (≤ 2,300 characters), otherwise the dialog explains why.
  - Share links: truncated, damaged, unknown version, expired; `hashchange` is handled.

---

## 6. Side-by-side comparison

| Dimension | V1 | V2 | V3 |
|---|---|---|---|
| **Correctness of output** | ❌ Malformed CSV (unquoted date comma) | ✅ | ✅ (Expenses page still uses the broken V1-era writer) |
| **Architecture** | Inline call to a utility | Layered: pure lib → reducer hook → components | Domain lib + app-wide runtime provider + page + modals |
| **Core abstraction** | CSV string | `ExportPayload` → format registry | `Report` model → many renderers |
| **State** | None | Local reducer + status machine | Global context reducer + persisted store + local drafts |
| **Async model** | Sync | Single awaited promise | Background jobs with stages, history, retry, scheduler, poller |
| **Error handling** | None | Validation + try/catch + retry | Validation + per-job failures + reload recovery + decode errors |
| **Security** | Formula injection open | Guarded; nothing leaves the device | Guarded; share links carry data (advisory expiry); simulated integrations must not ship as-is |
| **Accessibility** | Native button | Dialog semantics, focus trap, live region, radiogroups | Same, plus switches, tablists, live tray |
| **Bundle impact** | ~0 | +7.5 kB on dashboard (could be 0 with `next/dynamic`); PDF lazy | 0 on dashboard; 25.9 kB `/export` |
| **Runtime overhead** | None | None when closed | Timers on every page (3 s poll, 20 s scheduler) |
| **Test depth** | 1 new unit test | 42 (unit + component) | 45 (unit + integration) |
| **Extending formats** | Edit code | One file + registry entry | Formats are per-destination; add a serializer |
| **Extending content** | Edit code | Add filters | Add a template (one builder) |
| **Production readiness** | Needs the CSV fix | Ready | Local parts ready; cloud parts are prototypes that need a backend |
| **Maintenance cost** | Very low | Moderate | High |

---

## 7. Issues found, by priority

| # | Severity | Branch | Issue | Location |
|---|---|---|---|---|
| 1 | **High** | main, V1 (and the Expenses page on V2/V3) | Unquoted `formatDate` output breaks CSV columns (verified) | `lib/csvExport.ts` `generateCSV` |
| 2 | **High** (if shipped) | V3 | Simulated deliveries report success for work that never happened | `CloudExportProvider.execute`, `ConnectDialog` |
| 3 | Medium | main, V1 | CSV formula injection not neutralized (verified) | `lib/csvExport.ts` `escapeCSVField` |
| 4 | Medium | V3 | No cap on decompressed share-link size (tab hang from a crafted link) | `lib/cloud/share.ts` `pipe` / `decodeShare` |
| 5 | Medium | V3 | Share payload validated shallowly; malformed tables throw during render | `lib/cloud/share.ts:63`, `ReportView` |
| 6 | Low | V3 | "No server has a copy" overstates privacy (links persist in chat and history) | `app/share/page.tsx` footer |
| 7 | Low | V2 | Dialog code statically imported, +7.5 kB on dashboard | `components/export/ExportButton.tsx` |
| 8 | Low | V3 | Artificial ~1.3 s delay on real downloads | `CloudExportProvider` `stageDelayMs` |
| 9 | Low | V3 | Clipboard failures give no feedback | `ShareDialog.copy`, `HubPanels` `copy` |
| 10 | Low | V3 | `'error'` connection status never set (dead state) | `lib/cloud/types.ts`, `IntegrationLogo` |
| 11 | Low | V1 | No UTF-8 BOM, so Excel garbles non-ASCII text | `lib/csvExport.ts` `downloadCSV` |
| 12 | Info | V2 | `body.style.overflow` lock has no effect (the app scrolls inside `<main>`) | `ExportDialog.tsx:56` |
| 13 | Info | V2, V3 | Two CSV writers coexist; the old one is buggy | `lib/csvExport.ts` vs `lib/export` / `lib/cloud/format.ts` |

---

## 8. Recommendation: adopt or combine

These versions aren't mutually exclusive. They sit at different layers, and the strongest outcome combines them:

1. **Foundation: V2's `lib/export` core.** It's correct (ISO dates, BOM, escaping, injection guard), pure, tested, and built around a registry. Retire `lib/csvExport.ts` and point the Expenses page at it, which fixes issue #1 app-wide.
2. **Interaction: V1's one-click speed as the default path.** Keep a single-click "Export CSV" on the dashboard and Expenses page, using V2's writer and sensible defaults. Put V2's dialog behind a secondary "Export options…" action, lazy-loaded with `next/dynamic`.
3. **V3's features that are real today, with no backend:** the `Report` templates (a clear upgrade over raw rows for accountants and budgeting), zero-upload share links with the privacy options (after fixing issues #4–#6), and the pasteable text digest. These fit well as additional "formats" in V2's registry, or as a template picker in the dialog.
4. **Defer V3's cloud layer** (simulated integrations, scheduler, live sync, job tray) until there's a backend. On a client-only app, schedules only run while the tab is open, and simulated deliveries can't ship. The UI and the domain model are good prototypes to keep on the branch as the spec for that future work.

**If you can only pick one branch to merge as-is: V2.** It's the only one that's both correct and fully real, at a moderate maintenance cost.
