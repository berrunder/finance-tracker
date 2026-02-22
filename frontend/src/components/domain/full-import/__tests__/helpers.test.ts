import { describe, expect, it } from 'vitest'

import {
  detectDecimalSeparator,
  detectDelimiter,
  detectDateFormat,
  parsePreviewAmount,
  resolveCurrencyString,
} from '../helpers'

describe('detectDelimiter', () => {
  it('detects semicolon delimiter', () => {
    const csv = [
      'date;account;category;total;currency;description;transfer',
      '19.02.2026;All Airlines;Healthcare;-6600,00;RUB;Dental;',
    ].join('\n')
    expect(detectDelimiter(csv)).toBe(';')
  })

  it('detects comma delimiter', () => {
    const csv = [
      'date,account,category,total,currency,description,transfer',
      '19.02.2026,All Airlines,Healthcare,-6600.00,RUB,Dental,',
    ].join('\n')
    expect(detectDelimiter(csv)).toBe(',')
  })

  it('detects tab delimiter', () => {
    const csv = [
      'date\taccount\tcategory\ttotal\tcurrency\tdescription\ttransfer',
      '19.02.2026\tAll Airlines\tHealthcare\t-6600.00\tRUB\tDental\t',
    ].join('\n')
    expect(detectDelimiter(csv)).toBe('\t')
  })

  it('detects pipe delimiter', () => {
    const csv = [
      'date|account|category|total|currency|description|transfer',
      '19.02.2026|All Airlines|Healthcare|-6600.00|RUB|Dental|',
    ].join('\n')
    expect(detectDelimiter(csv)).toBe('|')
  })

  it('handles empty lines', () => {
    const csv = [
      '',
      'date;account;category;total;currency;description;transfer',
      '',
      '19.02.2026;All Airlines;Healthcare;-6600,00;RUB;Dental;',
    ].join('\n')
    expect(detectDelimiter(csv)).toBe(';')
  })
})

describe('detectDecimalSeparator', () => {
  it('detects comma as decimal (European format)', () => {
    expect(detectDecimalSeparator(['-6600,00', '27473,95', '237500,00'])).toBe(
      ',',
    )
  })

  it('detects dot as decimal (US format)', () => {
    expect(detectDecimalSeparator(['-6600.00', '27473.95', '237500.00'])).toBe(
      '.',
    )
  })

  it('detects comma as decimal with thousands dots', () => {
    expect(detectDecimalSeparator(['1.000,50', '2.500,00'])).toBe(',')
  })

  it('detects dot as decimal with thousands commas', () => {
    expect(detectDecimalSeparator(['1,000.50', '2,500.00'])).toBe('.')
  })

  it('handles amounts with currency symbols', () => {
    expect(detectDecimalSeparator(['₽6600,00', '-₽1000,50'])).toBe(',')
  })

  it('defaults to dot when ambiguous', () => {
    expect(detectDecimalSeparator([])).toBe('.')
  })
})

describe('detectDateFormat', () => {
  it('detects dd.MM.yyyy', () => {
    expect(detectDateFormat(['19.02.2026', '20.02.2026', '10.02.2026'])).toBe(
      'dd.MM.yyyy',
    )
  })

  it('detects yyyy-MM-dd', () => {
    expect(detectDateFormat(['2026-02-19', '2026-02-20', '2026-02-10'])).toBe(
      'yyyy-MM-dd',
    )
  })

  it('detects dd/MM/yyyy when day > 12', () => {
    expect(detectDateFormat(['19/02/2026', '20/02/2026'])).toBe('dd/MM/yyyy')
  })

  it('defaults to dd/MM/yyyy for ambiguous slash dates', () => {
    // Ambiguous case where all values are <= 12 — dd/MM/yyyy is tried first
    expect(detectDateFormat(['01/02/2026', '03/04/2026'])).toBe('dd/MM/yyyy')
  })

  it('returns fallback for empty input', () => {
    expect(detectDateFormat([])).toBe('dd.MM.yyyy')
  })
})

describe('resolveCurrencyString', () => {
  const currencies = [
    { code: 'RUB', name: 'Russian Ruble', symbol: '₽' },
    { code: 'AMD', name: 'Armenian Dram', symbol: 'դր.' },
    { code: 'USD', name: 'US Dollar', symbol: '$' },
  ]

  it('matches by code (case-insensitive)', () => {
    expect(resolveCurrencyString('RUB', currencies)).toBe('RUB')
    expect(resolveCurrencyString('rub', currencies)).toBe('RUB')
  })

  it('matches by symbol', () => {
    expect(resolveCurrencyString('դր.', currencies)).toBe('AMD')
    expect(resolveCurrencyString('$', currencies)).toBe('USD')
  })

  it('returns null for unknown currency', () => {
    expect(resolveCurrencyString('XYZ', currencies)).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(resolveCurrencyString('', currencies)).toBeNull()
  })
})

describe('parsePreviewAmount', () => {
  it('parses European format (comma decimal)', () => {
    expect(parsePreviewAmount('-6600,00', ',')).toBe(-6600)
    expect(parsePreviewAmount('27473,95', ',')).toBe(27473.95)
  })

  it('parses US format (dot decimal)', () => {
    expect(parsePreviewAmount('-6600.00', '.')).toBe(-6600)
    expect(parsePreviewAmount('27473.95', '.')).toBe(27473.95)
  })

  it('handles thousands separators', () => {
    expect(parsePreviewAmount('1.000,50', ',')).toBe(1000.5)
    expect(parsePreviewAmount('1,000.50', '.')).toBe(1000.5)
  })

  it('strips currency symbols', () => {
    expect(parsePreviewAmount('₽1000,00', ',')).toBe(1000)
  })

  it('returns null for invalid input', () => {
    expect(parsePreviewAmount('', ',')).toBeNull()
    expect(parsePreviewAmount('abc', ',')).toBeNull()
  })
})
