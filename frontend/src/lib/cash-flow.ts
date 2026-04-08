import Decimal from 'decimal.js'
import { convertToBase } from '@/lib/account-groups'
import type { CashFlowResponse, Category, ExchangeRate } from '@/types/api'

const MONTH_COUNT = 12

export type CashFlowRowKind =
  | 'section-total'
  | 'category'
  | 'subcategory'
  | 'uncategorized'
  | 'net'
  | 'cumulative'

export interface CashFlowRow {
  key: string
  label: string
  kind: CashFlowRowKind
  /** Length always equals 12. */
  monthValues: Decimal[]
  /** Sum of monthValues, except for 'cumulative' rows where it's the December value. */
  yearTotal: Decimal
}

export interface CashFlowTableModel {
  monthLabels: string[]
  rows: CashFlowRow[]
  isEmpty: boolean
}

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

function monthIndex(monthIso: string): number {
  // Backend returns "YYYY-MM-01"
  return Number(monthIso.slice(5, 7)) - 1
}

function emptyMonths(): Decimal[] {
  return Array.from({ length: MONTH_COUNT }, () => new Decimal(0))
}

function sumMonths(values: Decimal[]): Decimal {
  return values.reduce((sum, v) => sum.add(v), new Decimal(0))
}

function addInto(target: Decimal[], source: Decimal[]): void {
  for (let i = 0; i < MONTH_COUNT; i += 1) {
    target[i] = target[i].add(source[i])
  }
}

function subtract(a: Decimal[], b: Decimal[]): Decimal[] {
  return a.map((v, i) => v.sub(b[i]))
}

interface SectionResult {
  totals: Decimal[]
  rows: CashFlowRow[]
}

function buildSection(
  type: 'income' | 'expense',
  categories: Category[],
  ownByCategory: Map<string, Decimal[]>,
  uncategorizedMonths: Decimal[],
): SectionResult {
  const totals = emptyMonths()
  const rows: CashFlowRow[] = []

  // Sum a category's own months plus all descendants recursively.
  function rolledUp(cat: Category): Decimal[] {
    const total = [...(ownByCategory.get(cat.id) ?? emptyMonths())]
    for (const child of cat.children ?? []) {
      addInto(total, rolledUp(child))
    }
    return total
  }

  const byName = (a: Category, b: Category) => a.name.localeCompare(b.name)
  const topLevels = categories
    .filter((c) => c.type === type && !c.parent_id)
    .sort(byName)

  for (const top of topLevels) {
    const rolled = rolledUp(top)
    const yearSum = sumMonths(rolled)
    if (yearSum.isZero()) continue

    addInto(totals, rolled)
    rows.push({
      key: `cat-${type}-${top.id}`,
      label: top.name,
      kind: 'category',
      monthValues: rolled,
      yearTotal: yearSum,
    })

    const children = (top.children ?? []).slice().sort(byName)
    for (const child of children) {
      const childRolled = rolledUp(child)
      const childYear = sumMonths(childRolled)
      if (childYear.isZero()) continue
      rows.push({
        key: `cat-${type}-${child.id}`,
        label: child.name,
        kind: 'subcategory',
        monthValues: childRolled,
        yearTotal: childYear,
      })
    }
  }

  const uncatYear = sumMonths(uncategorizedMonths)
  if (!uncatYear.isZero()) {
    addInto(totals, uncategorizedMonths)
    rows.push({
      key: `cat-${type}-uncategorized`,
      label: 'Uncategorized',
      kind: 'uncategorized',
      monthValues: uncategorizedMonths,
      yearTotal: uncatYear,
    })
  }

  return { totals, rows }
}

function buildCumulativeRow(
  data: CashFlowResponse,
  baseCurrency: string,
  rates: ExchangeRate[],
): Decimal[] {
  // opening_balances contains every account (the SQL left-joins accounts);
  // each row carries its own currency, so we convert per-row.
  const openingByAccount = new Map<string, Decimal>()
  for (const r of data.opening_balances) {
    openingByAccount.set(
      r.account_id,
      convertToBase(r.opening_balance, r.currency, baseCurrency, rates),
    )
  }

  const changesByAccount = new Map<string, Decimal[]>()
  for (const r of data.monthly_changes) {
    let arr = changesByAccount.get(r.account_id)
    if (!arr) {
      arr = emptyMonths()
      changesByAccount.set(r.account_id, arr)
    }
    const idx = monthIndex(r.month)
    arr[idx] = arr[idx].add(
      convertToBase(r.net_change, r.currency, baseCurrency, rates),
    )
  }

  const totals = emptyMonths()
  for (const [accountId, opening] of openingByAccount) {
    const changes = changesByAccount.get(accountId) ?? emptyMonths()
    let running = opening
    for (let i = 0; i < MONTH_COUNT; i += 1) {
      running = running.add(changes[i])
      totals[i] = totals[i].add(running)
    }
  }
  return totals
}

export function buildCashFlowTable(
  data: CashFlowResponse,
  categories: Category[],
  rates: ExchangeRate[],
  baseCurrency: string,
): CashFlowTableModel {
  // Bucket per-category monthly amounts (converted to base currency).
  const incomeOwn = new Map<string, Decimal[]>()
  const expenseOwn = new Map<string, Decimal[]>()
  const incomeUncategorized = emptyMonths()
  const expenseUncategorized = emptyMonths()

  for (const row of data.category_monthly) {
    const idx = monthIndex(row.month)
    const baseAmount = convertToBase(
      row.amount,
      row.currency,
      baseCurrency,
      rates,
    )

    if (row.category_id == null) {
      const target =
        row.type === 'income' ? incomeUncategorized : expenseUncategorized
      target[idx] = target[idx].add(baseAmount)
      continue
    }

    const map = row.type === 'income' ? incomeOwn : expenseOwn
    let arr = map.get(row.category_id)
    if (!arr) {
      arr = emptyMonths()
      map.set(row.category_id, arr)
    }
    arr[idx] = arr[idx].add(baseAmount)
  }

  const income = buildSection(
    'income',
    categories,
    incomeOwn,
    incomeUncategorized,
  )
  const expense = buildSection(
    'expense',
    categories,
    expenseOwn,
    expenseUncategorized,
  )

  const rows: CashFlowRow[] = []

  rows.push({
    key: 'total-income',
    label: 'Total income',
    kind: 'section-total',
    monthValues: income.totals,
    yearTotal: sumMonths(income.totals),
  })
  rows.push(...income.rows)

  rows.push({
    key: 'total-expense',
    label: 'Total expense',
    kind: 'section-total',
    monthValues: expense.totals,
    yearTotal: sumMonths(expense.totals),
  })
  rows.push(...expense.rows)

  // Net (income - expense)
  const netMonths = subtract(income.totals, expense.totals)
  rows.push({
    key: 'net',
    label: 'Net (income − expense)',
    kind: 'net',
    monthValues: netMonths,
    yearTotal: sumMonths(netMonths),
  })

  // Cumulative (all funds at end of each month)
  const cumulativeMonths = buildCumulativeRow(data, baseCurrency, rates)
  rows.push({
    key: 'cumulative',
    label: 'Cumulative balance',
    kind: 'cumulative',
    monthValues: cumulativeMonths,
    yearTotal: cumulativeMonths[MONTH_COUNT - 1],
  })

  const isEmpty =
    income.totals.every((v) => v.isZero()) &&
    expense.totals.every((v) => v.isZero()) &&
    cumulativeMonths.every((v) => v.isZero())

  return {
    monthLabels: MONTH_LABELS,
    rows,
    isEmpty,
  }
}
