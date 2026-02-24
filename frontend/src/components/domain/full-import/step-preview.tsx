import { useMemo, useState } from 'react'
import { ArrowDownUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { FullImportRow } from '@/types/api'
import { cn } from '@/lib/utils'
import { parsePreviewAmount } from './helpers'

const PAGE_SIZE = 50

interface PreviewStats {
  total: number
  expenses: number
  incomes: number
  transfers: number
  errors: number
  newAccounts: string[]
  newCategories: string[]
}

interface StepPreviewProps {
  rows: FullImportRow[]
  decimalSeparator: ',' | '.'
  existingAccounts: string[]
  existingCategories: string[]
  isLoading: boolean
  error: string | null
  onBack: () => void
  onImport: () => void
}

function getRowType(
  isTransfer: boolean,
  amount: number | null,
): 'transfer' | 'income' | 'expense' {
  if (isTransfer) return 'transfer'
  if (amount !== null && amount >= 0) return 'income'
  return 'expense'
}

function getRowError(
  row: FullImportRow,
  decimalSeparator: ',' | '.',
): string | null {
  if (!row.date) return 'missing date'
  if (!row.account) return 'missing account'
  if (!row.total) return 'missing amount'
  if (!row.currency) return 'missing currency'

  const amount = parsePreviewAmount(row.total, decimalSeparator)
  if (amount === null) return 'amount not a number'

  return null
}

export function StepPreview({
  rows,
  decimalSeparator,
  existingAccounts,
  existingCategories,
  isLoading,
  error,
  onBack,
  onImport,
}: StepPreviewProps) {
  const [page, setPage] = useState(0)

  const stats = useMemo<PreviewStats>(() => {
    let expenses = 0
    let incomes = 0
    let transfers = 0
    let errors = 0
    const accountSet = new Set<string>()
    const categorySet = new Set<string>()
    const existAcctSet = new Set(existingAccounts.map((a) => a.toLowerCase()))
    const existCatSet = new Set(existingCategories.map((c) => c.toLowerCase()))

    for (const row of rows) {
      const errorReason = getRowError(row, decimalSeparator)
      const parsedAmount = parsePreviewAmount(row.total, decimalSeparator)
      if (errorReason) {
        errors++
        continue
      }
      const amount = parsedAmount as number
      if (row.transfer) {
        transfers++
        if (!existAcctSet.has(row.transfer.toLowerCase())) {
          accountSet.add(row.transfer)
        }
      } else if (amount < 0) {
        expenses++
      } else {
        incomes++
      }
      if (!existAcctSet.has(row.account.toLowerCase())) {
        accountSet.add(row.account)
      }
      if (row.category && !existCatSet.has(row.category.toLowerCase())) {
        const parentName = row.category.split('\\')[0]
        if (!existCatSet.has(parentName.toLowerCase())) {
          categorySet.add(row.category)
        } else if (row.category.includes('\\')) {
          categorySet.add(row.category)
        }
      }
    }

    return {
      total: rows.length,
      expenses,
      incomes,
      transfers: Math.floor(transfers / 2), // pairs
      errors,
      newAccounts: [...accountSet],
      newCategories: [...categorySet],
    }
  }, [rows, decimalSeparator, existingAccounts, existingCategories])

  const totalPages = Math.ceil(rows.length / PAGE_SIZE)
  const pageRows = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Total rows" value={stats.total} />
        <SummaryCard
          label="Expenses"
          value={stats.expenses}
          className="text-rose-600 dark:text-rose-400"
        />
        <SummaryCard
          label="Incomes"
          value={stats.incomes}
          className="text-emerald-600 dark:text-emerald-400"
        />
        <SummaryCard label="Transfers" value={stats.transfers} />
      </div>

      {stats.newAccounts.length > 0 && (
        <div className="rounded-lg border p-3">
          <span className="text-sm font-medium">New accounts to create: </span>
          <span className="text-sm text-muted-foreground">
            {stats.newAccounts.join(', ')}
          </span>
        </div>
      )}

      {stats.newCategories.length > 0 && (
        <div className="rounded-lg border p-3">
          <span className="text-sm font-medium">
            New categories to create:{' '}
          </span>
          <span className="text-sm text-muted-foreground">
            {stats.newCategories.join(', ')}
          </span>
        </div>
      )}

      {stats.errors > 0 && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-3">
          <span className="text-sm font-medium text-destructive">
            {stats.errors} row(s) have errors and will be skipped
          </span>
        </div>
      )}

      {/* Transaction table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Currency</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Error</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.map((row, idx) => {
              const amount = parsePreviewAmount(row.total, decimalSeparator)
              const errorReason = getRowError(row, decimalSeparator)
              const isError = errorReason !== null
              const type = getRowType(!!row.transfer, amount)

              return (
                <TableRow
                  key={page * PAGE_SIZE + idx}
                  className={cn(isError && 'bg-destructive/5 opacity-60')}
                >
                  <TableCell className="text-xs text-muted-foreground">
                    {page * PAGE_SIZE + idx + 1}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {row.date}
                  </TableCell>
                  <TableCell className="max-w-32 truncate text-sm">
                    {row.account}
                  </TableCell>
                  <TableCell className="max-w-32 truncate text-sm text-muted-foreground">
                    {row.category}
                  </TableCell>
                  <TableCell
                    className={cn(
                      'text-right font-mono text-sm',
                      type === 'income' &&
                        'text-emerald-600 dark:text-emerald-400',
                      type === 'expense' && 'text-rose-600 dark:text-rose-400',
                    )}
                  >
                    {row.total}
                  </TableCell>
                  <TableCell className="text-xs">{row.currency}</TableCell>
                  <TableCell className="max-w-40 truncate text-sm text-muted-foreground">
                    {row.description}
                  </TableCell>
                  <TableCell>
                    <TypeBadge type={type} transfer={row.transfer} />
                  </TableCell>
                  <TableCell className="max-w-44 text-xs">
                    {errorReason ? (
                      <span className="text-destructive">{errorReason}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page + 1} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
          >
            Next
          </Button>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onImport} disabled={isLoading || stats.total === 0}>
          {isLoading ? 'Importing...' : 'Import'}
        </Button>
      </div>
    </div>
  )
}

function SummaryCard({
  label,
  value,
  className,
}: {
  label: string
  value: number
  className?: string
}) {
  return (
    <div className="rounded-lg border p-3 text-center">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn('text-2xl font-bold', className)}>{value}</div>
    </div>
  )
}

function TypeBadge({ type, transfer }: { type: string; transfer: string }) {
  if (type === 'transfer') {
    return (
      <Badge variant="outline" className="gap-1 text-xs">
        <ArrowDownUp className="size-3" />
        {transfer}
      </Badge>
    )
  }
  return (
    <Badge
      variant={type === 'income' ? 'default' : 'secondary'}
      className={cn(
        'text-xs',
        type === 'income' &&
          'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
        type === 'expense' &&
          'bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300',
      )}
    >
      {type === 'income' ? 'Income' : 'Expense'}
    </Badge>
  )
}
