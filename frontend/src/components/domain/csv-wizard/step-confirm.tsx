import { Link } from 'react-router'
import { ArrowLeft, Check, RotateCcw, AlertTriangle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { CSVColumnMapping, CSVPreviewRow } from '@/types/api'

import {
  type DateFormatValue,
  formatDisplayDate,
  isRowValid,
  getRowTypeFromPreparedData,
} from './helpers'
import { ErrorBanner } from '@/components/domain/error-banner'

export interface StepConfirmProps {
  rows: CSVPreviewRow[]
  mapping: CSVColumnMapping
  dateFormat: DateFormatValue
  accountName: string
  selectedRows: Set<number>
  isLoading: boolean
  importResult: { imported: number } | null
  confirmError: string | null
  onSelectionChange: (selected: Set<number>) => void
  onFlipSelected: () => void
  onConfirm: () => void
  onBack: () => void
  onReset: () => void
}

export function StepConfirm({
  rows,
  mapping,
  dateFormat,
  accountName,
  selectedRows,
  isLoading,
  importResult,
  confirmError,
  onSelectionChange,
  onFlipSelected,
  onConfirm,
  onBack,
  onReset,
}: StepConfirmProps) {
  if (importResult) {
    return (
      <div className="space-y-6 py-4 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="flex size-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
            <Check className="size-7 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="text-lg font-semibold">Import complete</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Successfully imported{' '}
              <strong>{importResult.imported}</strong> transaction
              {importResult.imported !== 1 ? 's' : ''} into{' '}
              <strong>{accountName}</strong>.
            </p>
          </div>
        </div>
        <div className="flex justify-center gap-3">
          <Button asChild variant="default">
            <Link to="/transactions">View Transactions</Link>
          </Button>
          <Button variant="outline" onClick={onReset} className="gap-2">
            <RotateCcw className="size-4" />
            Import More
          </Button>
        </div>
      </div>
    )
  }

  const incomeRows = rows.filter((r) => getRowTypeFromPreparedData(r, mapping) === 'income')
  const expenseRows = rows.filter((r) => getRowTypeFromPreparedData(r, mapping) === 'expense')
  const validRows = rows.filter((r) => isRowValid(r, mapping, dateFormat))
  const invalidCount = rows.length - validRows.length

  const allSelected = rows.length > 0 && selectedRows.size === rows.length
  const someSelected = selectedRows.size > 0 && !allSelected

  const toggleAll = () => {
    if (allSelected) {
      onSelectionChange(new Set())
    } else {
      onSelectionChange(new Set(rows.map((_, i) => i)))
    }
  }

  const toggleRow = (i: number) => {
    const next = new Set(selectedRows)
    if (next.has(i)) next.delete(i)
    else next.add(i)
    onSelectionChange(next)
  }

  return (
    <div className="space-y-6">
      {confirmError && <ErrorBanner message={confirmError} />}

      {/* Summary */}
      <div className="space-y-2 rounded-lg border bg-muted/30 p-4">
        <p className="text-sm font-medium">
          Import {rows.length} transactions into <strong>{accountName}</strong>
        </p>
        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-emerald-500" />
            {incomeRows.length} income
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-rose-500" />
            {expenseRows.length} expense
          </span>
          {invalidCount > 0 && (
            <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="size-3.5" />
              {invalidCount} invalid (will be skipped)
            </span>
          )}
        </div>
      </div>

      {/* Bulk actions */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {selectedRows.size > 0
            ? `${selectedRows.size} row${selectedRows.size !== 1 ? 's' : ''} selected`
            : 'Select rows to flip their income/expense classification'}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={onFlipSelected}
          disabled={selectedRows.size === 0}
          className="gap-2"
        >
          <RotateCcw className="size-3.5" />
          Flip Selected
        </Button>
      </div>

      {/* Rows table */}
      <div className="max-h-96 overflow-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={someSelected ? 'indeterminate' : allSelected}
                  onCheckedChange={toggleAll}
                />
              </TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Type</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, i) => {
              const valid = isRowValid(row, mapping, dateFormat)
              const type = getRowTypeFromPreparedData(row, mapping)
              const dateVal = row.values[mapping.date] ?? '—'
              const amountVal = row.values[mapping.amount] ?? '—'
              const descVal = mapping.description
                ? (row.values[mapping.description] ?? '')
                : ''

              return (
                <TableRow
                  key={i}
                  className={cn(
                    'cursor-pointer',
                    selectedRows.has(i) && 'bg-primary/5',
                    !valid && 'opacity-50',
                  )}
                  onClick={() => toggleRow(i)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedRows.has(i)}
                      onCheckedChange={() => toggleRow(i)}
                    />
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-mono text-xs">
                    {formatDisplayDate(dateVal, dateFormat)}
                  </TableCell>
                  <TableCell className="max-w-48 truncate text-sm">
                    {descVal || '—'}
                  </TableCell>
                  <TableCell
                    className={cn(
                      'text-right font-mono text-sm',
                      type === 'income'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400',
                    )}
                  >
                    {amountVal}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-xs',
                        type === 'income'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                          : 'border-rose-200 bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400',
                      )}
                    >
                      {type}
                    </Badge>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={onBack}
          disabled={isLoading}
          className="gap-2"
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <Button
          onClick={onConfirm}
          disabled={isLoading || rows.length === 0}
          className="gap-2"
        >
          {isLoading ? (
            'Importing…'
          ) : (
            <>
              <Check className="size-4" />
              Import {validRows.length} Transaction{validRows.length !== 1 ? 's' : ''}
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
