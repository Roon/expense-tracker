# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev                                # dev server on :3000
npm run build                              # production build (also type-checks and lints)
npm run lint                               # next lint (next/core-web-vitals + next/typescript)
npx tsc --noEmit                           # type-check only
npm test                                   # all Jest tests
npx jest __tests__/utils.test.ts           # one file
npx jest -t "formats amount"               # tests whose name matches
```

**If `tsc` reports errors in `.next/types/...` about missing modules:** `tsconfig.json` includes `.next/types/**`, which a build generates. After switching branches, types left over from a build on another branch point at routes that don't exist here. Delete `.next/types` or run `npm run build` again.

**Run `npm install` after switching branches.** The feature branches add different dependencies, so `node_modules` must match the branch you're on.

## Architecture

This is a Next.js 14 App Router app that is **entirely client-side**. Every page is a `'use client'` component, and all data lives in the browser's `localStorage`. There's no API, database or server logic. The `@/` import alias points at the repo root.

### Data layer: `hooks/useExpenses.ts`
- It's the only way pages read and write expenses. Data is stored under the localStorage key `expense-tracker-expenses`.
- **There's no shared store.** Each call to `useExpenses()` keeps its own state and loads from localStorage on mount. A change made through one hook instance isn't seen by another instance already mounted on the same page. Pages stay consistent only because navigating remounts them.
- **Check `isLoaded` before rendering.** It's `false` until the post-mount load, and every page shows a skeleton until then. Server-rendered HTML has no data.
- The hook returns `expenses` sorted newest first. On `main` that array is rebuilt on every render, so don't use its identity as a `useMemo`/`useEffect` dependency.

### Domain types and conventions (`lib/`)
- **`types.ts`:** the `Expense` type and the fixed `Category` union. `CATEGORIES` also sets display order, and there are two colour maps: `CATEGORY_COLORS` (hex values, for charts) and `CATEGORY_BADGE_COLORS` (Tailwind classes).
- **Dates are `YYYY-MM-DD` strings.**
  - Compare them as strings; that sorts chronologically.
  - To turn one into a `Date`, split it into year, month and day and build a local date, as `formatDate` and `filterExpensesByDateRange` in `lib/utils.ts` do. `new Date('2024-01-15')` parses as UTC midnight and can land on the previous day in local time.
- **Forms:** `schema.ts` is a zod schema for the form, where the amount is a **string**. The new and edit pages convert values to an `Expense` with `parseFloat(amount)`.
- **`utils.ts`:** formatting (currency, dates) plus the date-range filtering and monthly totals used by the dashboard and the expense list.
- **`exporting/`:** the CSV export behind the dashboard's "Export Data" button (`components/ExportDataButton.tsx`) and the Expenses page's "Export CSV". It's built from small contracts (`Serializer`, `FileSaver`, `Exporter` in `types.ts`), and concrete pieces are wired up only in `index.ts`.
  - To add, remove or reorder CSV columns, edit the list in `expenseColumns.ts`; the writer in `csv.ts` doesn't change.
  - The writer escapes every cell. That matters because `formatDate` produces "Jan 15, 2024", which contains a comma.
  - For another format or delivery method, add a new `Serializer` or `FileSaver`. Tests pass in-memory fakes.
  - `__tests__/csvExport.characterization.test.ts` pins the exact CSV output, so a failure there means the output changed.

### UI
- **Layout:** `app/layout.tsx` wraps every page in `components/AppShell.tsx`. The desktop sidebar and mobile bottom tab bar both use one `NAV_ITEMS` list, with active-route rules in `isActive`.
- **The scroll container is `<main className="overflow-auto">`, not `body`.** Locking body scroll has no effect.
- **Charts** (Recharts) load through `next/dynamic` with `ssr: false` on the dashboard.
- **Styling:** Tailwind only. Its `content` globs cover `app/`, `components/` and `pages/`, so **class names written anywhere else (e.g. `lib/`) aren't generated** unless you add that folder to `tailwind.config.ts`.

### Tests (`__tests__/`, Jest + jsdom + Testing Library)
- **localStorage:** tests replace it with a mock on `window` (see `useExpenses.test.ts`).
- **jsdom lacks APIs browsers have:** `TextEncoder`/`TextDecoder`, `Blob.text()` and `CompressionStream`. Polyfill them from Node's `util`, or put `/** @jest-environment node */` at the top of files that test pure logic.
- **Clipboard:** `userEvent.setup()` replaces `navigator.clipboard` with its own stub. Check copies with `navigator.clipboard.readText()` rather than mocking `writeText` beforehand.

## Branch context

- **Three export versions.** `feature-data-export-v1`, `-v2` and `-v3` are three alternative data-export implementations, compared in `code-analysis.md` on `docs/export-code-analysis`.
  - V1 (the CSV button and `lib/exporting/`) was merged into `main` through PR #1.
  - V2 and V3 aren't merged. V2 adds `jspdf`; V3 adds `qrcode`, and its cloud integrations are simulated. Both branched off `main` before V1 landed, so they still use the old `lib/csvExport.ts`.
- **Build history.** The original app was built task by task: `.superpowers/sdd/` holds the task briefs, reports and review diffs. The design spec and plan are in `../docs/superpowers/`, outside this repo.
