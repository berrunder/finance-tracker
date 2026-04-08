import { useMemo } from 'react'
import Decimal from 'decimal.js'
import { buildCashFlowTable, type CashFlowRow } from '@/lib/cash-flow'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { CashFlowResponse, Category, ExchangeRate } from '@/types/api'

interface CashFlowTableProps {
  data: CashFlowResponse
  categories: Category[]
  rates: ExchangeRate[]
  baseCurrency: string
}

function formatCell(value: Decimal, currency: string): string {
  if (value.isZero()) return '—'
  return formatMoney(value.toFixed(2), currency)
}

function rowClassName(row: CashFlowRow): string {
  switch (row.kind) {
    case 'section-total':
      return 'font-semibold bg-muted/40'
    case 'net':
      return 'font-semibold border-t-2'
    case 'cumulative':
      return 'font-semibold'
    default:
      return ''
  }
}

function labelCellClassName(row: CashFlowRow): string {
  const base = 'sticky left-0 bg-background z-10'
  if (row.kind === 'subcategory') return cn(base, 'pl-8 text-muted-foreground')
  if (row.kind === 'uncategorized')
    return cn(base, 'pl-8 text-muted-foreground italic')
  return base
}

function valueCellClassName(row: CashFlowRow, value: Decimal): string {
  if (row.kind === 'net' || row.kind === 'cumulative') {
    if (value.isNegative()) return 'text-red-600 dark:text-red-400'
    if (value.isPositive()) return 'text-green-600 dark:text-green-400'
  }
  return ''
}

export function CashFlowTable({
  data,
  categories,
  rates,
  baseCurrency,
}: CashFlowTableProps) {
  const model = useMemo(
    () => buildCashFlowTable(data, categories, rates, baseCurrency),
    [data, categories, rates, baseCurrency],
  )

  if (model.isEmpty) {
    return (
      <p className="text-sm text-muted-foreground">
        No transactions in {data.year}.
      </p>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="sticky left-0 bg-background z-10">
            Category
          </TableHead>
          {model.monthLabels.map((label) => (
            <TableHead key={label} className="text-right">
              {label}
            </TableHead>
          ))}
          <TableHead className="text-right font-semibold">Total</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {model.rows.map((row) => (
          <TableRow key={row.key} className={rowClassName(row)}>
            <TableCell className={labelCellClassName(row)}>
              {row.label}
            </TableCell>
            {row.monthValues.map((value, i) => (
              <TableCell
                key={i}
                className={cn('text-right', valueCellClassName(row, value))}
              >
                {formatCell(value, baseCurrency)}
              </TableCell>
            ))}
            <TableCell
              className={cn(
                'text-right font-semibold',
                valueCellClassName(row, row.yearTotal),
              )}
            >
              {formatCell(row.yearTotal, baseCurrency)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
