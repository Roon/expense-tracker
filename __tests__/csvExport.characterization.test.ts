// Locks in the observable behavior of the expense CSV export so structural refactors can't change it.
import { createExpenseCsvExporter, expenseCsvSerializer } from '@/lib/exporting'
import type { Expense } from '@/lib/types'

const generateCSV = (expenses: Expense[]) => expenseCsvSerializer.serialize(expenses)
const downloadCSV = (expenses: Expense[], filename?: string) => createExpenseCsvExporter(filename).export(expenses)

const TRICKY: Expense[] = [
  { id: '1', date: '2024-01-15', amount: 25.5, category: 'Food', description: 'Lunch' },
  { id: '2', date: '2024-02-01', amount: 1000, category: 'Bills', description: 'Rent, February' },
  { id: '3', date: '2024-03-09', amount: 0.1, category: 'Other', description: 'He said "hi"' },
  { id: '4', date: '2024-12-31', amount: 7, category: 'Shopping', description: 'Line one\nline two' },
]

describe('generateCSV output', () => {
  it('is byte-for-byte stable', () => {
    expect(generateCSV(TRICKY)).toBe(
      [
        'Date,Category,Amount,Description',
        '"Jan 15, 2024",Food,25.50,Lunch',
        '"Feb 1, 2024",Bills,1000.00,"Rent, February"',
        '"Mar 9, 2024",Other,0.10,"He said ""hi"""',
        '"Dec 31, 2024",Shopping,7.00,"Line one\nline two"',
      ].join('\n'),
    )
  })
})

describe('downloadCSV', () => {
  let blobs: Blob[]
  let clicked: HTMLAnchorElement[]

  beforeEach(() => {
    blobs = []
    clicked = []
    URL.createObjectURL = jest.fn((b: Blob) => {
      blobs.push(b)
      return 'blob:mock'
    })
    URL.revokeObjectURL = jest.fn()
    jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push(this)
    })
  })

  afterEach(() => jest.restoreAllMocks())

  it('downloads the CSV as expenses.csv by default and revokes the URL', () => {
    downloadCSV(TRICKY)
    expect(blobs).toHaveLength(1)
    expect(blobs[0].type).toBe('text/csv;charset=utf-8;')
    expect(blobs[0].size).toBe(Buffer.byteLength(generateCSV(TRICKY), 'utf8'))
    expect(clicked).toHaveLength(1)
    expect(clicked[0].download).toBe('expenses.csv')
    expect(clicked[0].href).toBe('blob:mock')
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock')
  })

  it('honors a custom filename', () => {
    downloadCSV(TRICKY, 'q1.csv')
    expect(clicked[0].download).toBe('q1.csv')
  })
})
