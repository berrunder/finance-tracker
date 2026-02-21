import Papa from 'papaparse'
import { parse, isValid, format as formatDate } from 'date-fns'
import type { CSVColumnMapping, CSVPreviewRow } from '@/types/api'

// ─── Types ────────────────────────────────────────────────────────────────────

export type Step = 1 | 2 | 3
export type AmountConvention = 'negative-expenses' | 'all-expenses'

// ─── Date format config ───────────────────────────────────────────────────────

export const DATE_FORMATS = [
  {
    label: 'YYYY-MM-DD (2024-01-15)',
    value: 'yyyy-MM-dd',
    example: '2024-01-15',
  },
  {
    label: 'MM/DD/YYYY (01/15/2024)',
    value: 'MM/dd/yyyy',
    example: '01/15/2024',
  },
  {
    label: 'DD/MM/YYYY (15/01/2024)',
    value: 'dd/MM/yyyy',
    example: '15/01/2024',
  },
  {
    label: 'DD.MM.YYYY (15.01.2024)',
    value: 'dd.MM.yyyy',
    example: '15.01.2024',
  },
] as const

export type DateFormatValue = (typeof DATE_FORMATS)[number]['value']

// ─── Constants ────────────────────────────────────────────────────────────────

const INCOME_INDICATORS = new Set(['income', 'credit', 'in', '+', '1'])

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function parseAmount(value: string): number {
  return parseFloat(value.replace(/[^\d.-]/g, ''))
}

function isIncomeIndicator(value: string): boolean {
  return INCOME_INDICATORS.has(value.toLowerCase().trim())
}

export function parseCsvRowsFromFile(
  file: File,
  headers: string[],
): Promise<CSVPreviewRow[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<string[]>(file, {
      skipEmptyLines: true,
      complete: (result) => {
        if (result.errors.length > 0) {
          reject(new Error(result.errors[0].message))
          return
        }

        const dataRows = result.data.slice(1)
        const rows = dataRows.map((record) => {
          const values: Record<string, string> = {}
          headers.forEach((header, index) => {
            if (index < record.length) {
              values[header] = `${record[index] ?? ''}`.trim()
            }
          })
          return { values }
        })

        resolve(rows)
      },
      error: (error) => reject(error),
    })
  })
}

export function detectDateFormat(
  rows: CSVPreviewRow[],
  column: string,
): DateFormatValue {
  const samples = rows
    .slice(0, 5)
    .map((r) => r.values[column])
    .filter(Boolean)
  if (!samples.length) return 'yyyy-MM-dd'

  for (const fmt of DATE_FORMATS) {
    if (
      samples.every((d) => {
        try {
          return isValid(parse(d, fmt.value, new Date()))
        } catch {
          return false
        }
      })
    ) {
      return fmt.value
    }
  }
  return 'yyyy-MM-dd'
}

export function formatDisplayDate(value: string, formatStr: string): string {
  try {
    const parsed = parse(value, formatStr, new Date())
    if (!isValid(parsed)) return value
    return parsed.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return value
  }
}

export function isRowValid(
  row: CSVPreviewRow,
  mapping: Partial<CSVColumnMapping>,
  dateFormat: string,
): boolean {
  if (!mapping.date || !mapping.amount) return false
  const dateVal = row.values[mapping.date] ?? ''
  const amountVal = row.values[mapping.amount] ?? ''
  if (!amountVal || isNaN(parseAmount(amountVal))) return false
  try {
    return isValid(parse(dateVal, dateFormat, new Date()))
  } catch {
    return false
  }
}

export function getRowType(
  row: CSVPreviewRow,
  mapping: Partial<CSVColumnMapping>,
  convention: AmountConvention,
): 'income' | 'expense' {
  if (mapping.type && row.values[mapping.type]) {
    const v = row.values[mapping.type]
    if (isIncomeIndicator(v)) return 'income'
    return 'expense'
  }
  if (convention === 'all-expenses') return 'expense'
  if (!mapping.amount) return 'expense'
  const num = parseAmount(row.values[mapping.amount] ?? '')
  return isNaN(num) || num >= 0 ? 'income' : 'expense'
}

export function getRowTypeFromPreparedData(
  row: CSVPreviewRow,
  mapping: Partial<CSVColumnMapping>,
): 'income' | 'expense' {
  if (mapping.type && row.values[mapping.type]) {
    return isIncomeIndicator(row.values[mapping.type]) ? 'income' : 'expense'
  }
  if (!mapping.amount) return 'expense'
  const num = parseAmount(row.values[mapping.amount] ?? '')
  return isNaN(num) || num >= 0 ? 'income' : 'expense'
}

export function negateAmountString(value: string): string {
  const trimmed = value.trim()
  if (trimmed.startsWith('-')) return trimmed.slice(1)
  return '-' + trimmed
}

export function flipRowClassification(
  row: CSVPreviewRow,
  mapping: Partial<CSVColumnMapping>,
): CSVPreviewRow {
  if (mapping.type) {
    const current = row.values[mapping.type] ?? ''
    const nextType = isIncomeIndicator(current) ? 'expense' : 'income'
    return {
      ...row,
      values: { ...row.values, [mapping.type]: nextType },
    }
  }

  if (mapping.amount) {
    const originalAmount = row.values[mapping.amount] ?? ''
    return {
      ...row,
      values: {
        ...row.values,
        [mapping.amount]: negateAmountString(originalAmount),
      },
    }
  }

  return row
}

export function applyConventionToRows(
  rows: CSVPreviewRow[],
  mapping: Partial<CSVColumnMapping>,
  convention: AmountConvention,
): CSVPreviewRow[] {
  if (convention !== 'all-expenses' || !mapping.amount) return rows
  return rows.map((row) => {
    const amountVal = row.values[mapping.amount!] ?? ''
    const num = parseAmount(amountVal)
    if (!isNaN(num) && num > 0) {
      return {
        ...row,
        values: {
          ...row.values,
          [mapping.amount!]: negateAmountString(amountVal),
        },
      }
    }
    return row
  })
}

export function normalizeRowsForSubmit(
  rows: CSVPreviewRow[],
  mapping: CSVColumnMapping,
  dateFormat: DateFormatValue,
): CSVPreviewRow[] {
  return rows.map((row) => {
    const rawDate = row.values[mapping.date] ?? ''
    let normalizedDate = rawDate

    try {
      const parsed = parse(rawDate, dateFormat, new Date())
      if (isValid(parsed)) {
        normalizedDate = formatDate(parsed, 'yyyy-MM-dd')
      }
    } catch {
      // Keep original; backend will skip invalid rows.
    }

    return {
      ...row,
      values: {
        ...row.values,
        [mapping.date]: normalizedDate,
      },
    }
  })
}
