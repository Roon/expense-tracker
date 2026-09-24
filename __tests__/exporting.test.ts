/**
 * @jest-environment node
 */
import { createCsvSerializer, escapeCsvField, type CsvColumn } from '@/lib/exporting/csv'
import { createExporter } from '@/lib/exporting/exporter'
import type { ExportFile, FileSaver, Serializer } from '@/lib/exporting/types'
import { createExpenseCsvExporter } from '@/lib/exporting'
import type { Expense } from '@/lib/types'

interface Pet {
  name: string
  legs: number
}

describe('createCsvSerializer', () => {
  const columns: CsvColumn<Pet>[] = [
    { header: 'Name', value: (p) => p.name },
    { header: 'Legs', value: (p) => String(p.legs) },
  ]

  it('works for any item type, in column-definition order', () => {
    expect(createCsvSerializer(columns).serialize([{ name: 'Rex', legs: 4 }])).toBe('Name,Legs\nRex,4')
  })

  it('escapes every cell, headers included', () => {
    const tricky = createCsvSerializer<Pet>([{ header: 'Name, full', value: (p) => p.name }])
    expect(tricky.serialize([{ name: 'Mr "Tibbles"', legs: 4 }])).toBe('"Name, full"\n"Mr ""Tibbles"""')
  })

  it('emits only the header for no items', () => {
    expect(createCsvSerializer(columns).serialize([])).toBe('Name,Legs')
  })

  it('is extended by adding columns, not by changing the encoder', () => {
    const withExtra = createCsvSerializer([...columns, { header: 'Loud', value: (p: Pet) => (p.name === 'Rex' ? 'yes' : 'no') }])
    expect(withExtra.serialize([{ name: 'Rex', legs: 4 }])).toBe('Name,Legs,Loud\nRex,4,yes')
  })
})

describe('escapeCsvField', () => {
  it.each([
    ['plain', 'plain'],
    ['a,b', '"a,b"'],
    ['say "hi"', '"say ""hi"""'],
    ['two\nlines', '"two\nlines"'],
  ])('%j → %j', (input, expected) => {
    expect(escapeCsvField(input)).toBe(expected)
  })
})

/** In-memory FileSaver: a substitute for the browser implementation. */
function recordingSaver(): FileSaver & { saved: ExportFile[] } {
  const saved: ExportFile[] = []
  return { saved, save: (file) => saved.push(file) }
}

describe('createExporter', () => {
  it('passes serialized content and the serializer mime type to the saver', () => {
    const serializer: Serializer<number> = { mimeType: 'text/plain', serialize: (xs) => xs.join('+') }
    const saver = recordingSaver()
    createExporter({ serializer, saver, filename: 'sum.txt' }).export([1, 2, 3])
    expect(saver.saved).toEqual([{ content: '1+2+3', mimeType: 'text/plain', filename: 'sum.txt' }])
  })

  it('accepts any serializer that honors the contract (format swap without code changes)', () => {
    const json: Serializer<Pet> = { mimeType: 'application/json', serialize: (xs) => JSON.stringify(xs) }
    const saver = recordingSaver()
    createExporter({ serializer: json, saver, filename: 'pets.json' }).export([{ name: 'Rex', legs: 4 }])
    expect(saver.saved[0]).toEqual({ content: '[{"name":"Rex","legs":4}]', mimeType: 'application/json', filename: 'pets.json' })
  })
})

describe('createExpenseCsvExporter', () => {
  it('wires the expense CSV layout to an injected saver', () => {
    const saver = recordingSaver()
    const expense: Expense = { id: '1', date: '2024-01-15', amount: 25.5, category: 'Food', description: 'Lunch' }
    createExpenseCsvExporter('mine.csv', saver).export([expense])
    expect(saver.saved).toEqual([
      {
        content: 'Date,Category,Amount,Description\n"Jan 15, 2024",Food,25.50,Lunch',
        mimeType: 'text/csv;charset=utf-8;',
        filename: 'mine.csv',
      },
    ])
  })
})
