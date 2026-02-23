import type { Currency } from '@/types/api'

export type Step = 1 | 2 | 3 | 4

export const EXPECTED_COLUMNS = 7

export const DELIMITERS = [';', ',', '\t', '|'] as const

export const DATE_FORMATS = [
  'dd.MM.yyyy',
  'yyyy-MM-dd',
  'dd/MM/yyyy',
  'MM/dd/yyyy',
] as const

export type DateFormatValue = (typeof DATE_FORMATS)[number]

export interface ParsedRow {
  date: string
  account: string
  category: string
  total: string
  currency: string
  description: string
  transfer: string
}

/**
 * Detect the delimiter used in a CSV file by testing candidates
 * against the first few lines and picking the one that consistently
 * produces EXPECTED_COLUMNS columns.
 */
export function detectDelimiter(rawText: string): string {
  const lines = rawText.split('\n').filter((l) => l.trim().length > 0)
  const sampleLines = lines.slice(0, Math.min(10, lines.length))

  let bestDelimiter = ';'
  let bestScore = 0

  for (const delim of DELIMITERS) {
    const counts = sampleLines.map((line) => line.split(delim).length)
    const consistent = counts.every((c) => c === counts[0])
    if (consistent && counts[0] === EXPECTED_COLUMNS) {
      return delim // Perfect match
    }
    // Score by how many lines have the expected column count
    const score = counts.filter((c) => c === EXPECTED_COLUMNS).length
    if (score > bestScore) {
      bestScore = score
      bestDelimiter = delim
    }
  }

  return bestDelimiter
}

/**
 * Detect the decimal separator used in amount values.
 * Heuristic: If an amount contains both '.' and ',', the last one is decimal.
 * If only ',' appears followed by exactly 2 digits at end, it's decimal.
 */
export function detectDecimalSeparator(amounts: string[]): ',' | '.' {
  let commaDecimalScore = 0
  let dotDecimalScore = 0

  for (const raw of amounts) {
    const cleaned = raw.replace(/[^\d.,-]/g, '')
    if (!cleaned) continue

    const hasComma = cleaned.includes(',')
    const hasDot = cleaned.includes('.')

    if (hasComma && hasDot) {
      // Last separator is the decimal one
      const lastComma = cleaned.lastIndexOf(',')
      const lastDot = cleaned.lastIndexOf('.')
      if (lastComma > lastDot) {
        commaDecimalScore += 2
      } else {
        dotDecimalScore += 2
      }
    } else if (hasComma && !hasDot) {
      // Check if comma is followed by exactly 2 digits at end
      if (/,\d{2}$/.test(cleaned)) {
        commaDecimalScore++
      }
    } else if (hasDot && !hasComma) {
      if (/\.\d{2}$/.test(cleaned)) {
        dotDecimalScore++
      }
    }
  }

  return commaDecimalScore > dotDecimalScore ? ',' : '.'
}

/**
 * Detect the date format by trying to parse sample dates with each format.
 * Returns the first format that successfully parses all samples.
 */
export function detectDateFormat(dates: string[]): DateFormatValue {
  const samples = dates.filter((d) => d.trim().length > 0).slice(0, 10)
  if (samples.length === 0) return 'dd.MM.yyyy'

  for (const format of DATE_FORMATS) {
    if (samples.every((d) => isValidDate(d, format))) {
      // Disambiguation: if format is MM/dd/yyyy, check if any value > 12
      // in first position, which would force dd/MM/yyyy
      if (format === 'MM/dd/yyyy') {
        const hasHighFirst = samples.some((d) => {
          const first = parseInt(d.split('/')[0], 10)
          return first > 12
        })
        if (hasHighFirst) continue // Skip, dd/MM/yyyy is better
      }
      return format
    }
  }

  return 'dd.MM.yyyy' // fallback
}

function isValidDate(value: string, format: DateFormatValue): boolean {
  const parts = splitDate(value, format)
  if (!parts) return false
  const { year, month, day } = parts
  if (month < 1 || month > 12) return false
  if (day < 1 || day > 31) return false
  if (year < 1900 || year > 2100) return false
  return true
}

function splitDate(
  value: string,
  format: DateFormatValue,
): { year: number; month: number; day: number } | null {
  if (format === 'yyyy-MM-dd') {
    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (!m) return null
    return { year: +m[1], month: +m[2], day: +m[3] }
  }
  if (format === 'dd.MM.yyyy') {
    const m = value.match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
    if (!m) return null
    return { year: +m[3], month: +m[2], day: +m[1] }
  }
  if (format === 'dd/MM/yyyy') {
    const m = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    if (!m) return null
    return { year: +m[3], month: +m[2], day: +m[1] }
  }
  if (format === 'MM/dd/yyyy') {
    const m = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    if (!m) return null
    return { year: +m[3], month: +m[1], day: +m[2] }
  }
  return null
}

/**
 * Resolve a currency string against known currencies by code or symbol.
 * Returns the currency code if found, null otherwise.
 */
export function resolveCurrencyString(
  raw: string,
  currencies: Currency[],
): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  // Code match (case-insensitive)
  for (const c of currencies) {
    if (c.code.toLowerCase() === trimmed.toLowerCase()) {
      return c.code
    }
  }

  // Symbol match
  for (const c of currencies) {
    if (c.symbol === trimmed) {
      return c.code
    }
  }

  return null
}

/**
 * Parse an amount string for display preview (not for backend submission).
 */
export function parsePreviewAmount(
  raw: string,
  decimalSep: ',' | '.',
): number | null {
  let cleaned = raw.replace(/[^\d.,-]/g, '')
  if (!cleaned) return null

  if (decimalSep === ',') {
    cleaned = cleaned.replace(/\./g, '') // remove thousands dots
    cleaned = cleaned.replace(/,/g, '.') // comma -> dot for parseFloat
  } else {
    cleaned = cleaned.replace(/,/g, '') // remove thousands commas
  }

  const num = parseFloat(cleaned)
  return isNaN(num) ? null : num
}

/**
 * Determine transaction type from a parsed amount.
 */
export function getTransactionType(
  amount: number,
): 'income' | 'expense' | 'transfer' {
  // Transfer detection is done at a higher level (by checking transfer field)
  return amount >= 0 ? 'income' : 'expense'
}
