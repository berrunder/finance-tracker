import { useState } from 'react'
import { CheckCircle2, ChevronDown, ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { FullImportResponse } from '@/types/api'

interface StepResultsProps {
  result: FullImportResponse
  onReset: () => void
}

export function StepResults({ result, onReset }: StepResultsProps) {
  const [showFailures, setShowFailures] = useState(false)
  const hasFailures = result.failed_rows && result.failed_rows.length > 0

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-3 py-4">
        <CheckCircle2 className="size-12 text-emerald-500" />
        <h2 className="text-xl font-semibold">Import Complete</h2>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <ResultCard label="Transactions imported" value={result.imported} />
        {result.accounts_created?.length > 0 && (
          <ResultCard
            label="Accounts created"
            value={result.accounts_created.length}
            detail={result.accounts_created.join(', ')}
          />
        )}
        {result.categories_created?.length > 0 && (
          <ResultCard
            label="Categories created"
            value={result.categories_created.length}
            detail={result.categories_created.join(', ')}
          />
        )}
        {result.currencies_created?.length > 0 && (
          <ResultCard
            label="Currencies created"
            value={result.currencies_created.length}
            detail={result.currencies_created.join(', ')}
          />
        )}
      </div>

      {hasFailures && (
        <div className="rounded-lg border border-destructive/50">
          <button
            className="flex w-full items-center justify-between p-3"
            onClick={() => setShowFailures(!showFailures)}
          >
            <span className="text-sm font-medium text-destructive">
              {result.failed_rows.length} row(s) failed
            </span>
            {showFailures ? (
              <ChevronDown className="size-4 text-destructive" />
            ) : (
              <ChevronRight className="size-4 text-destructive" />
            )}
          </button>

          {showFailures && (
            <div className="border-t">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Row</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Currency</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Transfer</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.failed_rows.map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-mono text-xs">
                        {row.row_number}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {row.data.date}
                      </TableCell>
                      <TableCell className="text-sm">
                        {row.data.account}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.data.category}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {row.data.total}
                      </TableCell>
                      <TableCell className="text-xs">
                        {row.data.currency}
                      </TableCell>
                      <TableCell className="max-w-48 truncate text-sm text-muted-foreground">
                        {row.data.description}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.data.transfer}
                      </TableCell>
                      <TableCell className="text-sm text-destructive">
                        {row.error}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-center gap-3">
        <Button variant="outline" asChild>
          <Link to="/transactions">View Transactions</Link>
        </Button>
        <Button onClick={onReset}>Import More</Button>
      </div>
    </div>
  )
}

function ResultCard({
  label,
  value,
  detail,
}: {
  label: string
  value: number
  detail?: string
}) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
      {detail && (
        <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
      )}
    </div>
  )
}
