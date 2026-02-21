import { ArrowLeft, ArrowRight, AlertTriangle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'
import type { CSVColumnMapping, CSVUploadResponse } from '@/types/api'

import {
  type AmountConvention,
  type DateFormatValue,
  DATE_FORMATS,
  detectDateFormat,
  formatDisplayDate,
  isRowValid,
  getRowType,
} from './helpers'

const NONE_VALUE = '__none__'

export interface StepMapProps {
  uploadData: CSVUploadResponse
  mapping: Partial<CSVColumnMapping>
  dateFormat: DateFormatValue
  amountConvention: AmountConvention
  isPreparing: boolean
  onMappingChange: (mapping: Partial<CSVColumnMapping>) => void
  onDateFormatChange: (fmt: DateFormatValue) => void
  onConventionChange: (c: AmountConvention) => void
  onBack: () => void
  onNext: () => void
}

export function StepMap({
  uploadData,
  mapping,
  dateFormat,
  amountConvention,
  isPreparing,
  onMappingChange,
  onDateFormatChange,
  onConventionChange,
  onBack,
  onNext,
}: StepMapProps) {
  const { headers, preview } = uploadData
  const previewRows = preview.slice(0, 10)

  const update = (key: keyof CSVColumnMapping, value: string) => {
    const next = { ...mapping, [key]: value === NONE_VALUE ? undefined : value }
    if (key === 'date' && value && value !== NONE_VALUE) {
      onDateFormatChange(detectDateFormat(previewRows, value))
    }
    onMappingChange(next)
  }

  const headerOptions = (
    <>
      <SelectItem value={NONE_VALUE}>— Not mapped —</SelectItem>
      {headers.map((h) => (
        <SelectItem key={h} value={h}>
          {h}
        </SelectItem>
      ))}
    </>
  )

  const canProceed = !!mapping.date && !!mapping.amount
  const invalidCount = previewRows.filter(
    (r) => !isRowValid(r, mapping, dateFormat),
  ).length

  return (
    <div className="space-y-6">
      {/* Column mappings */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>
            Date Column <span className="text-destructive">*</span>
          </Label>
          <Select
            value={mapping.date ?? NONE_VALUE}
            onValueChange={(v) => update('date', v)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select column…" />
            </SelectTrigger>
            <SelectContent>{headerOptions}</SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>
            Amount Column <span className="text-destructive">*</span>
          </Label>
          <Select
            value={mapping.amount ?? NONE_VALUE}
            onValueChange={(v) => update('amount', v)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select column…" />
            </SelectTrigger>
            <SelectContent>{headerOptions}</SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Description Column</Label>
          <Select
            value={mapping.description ?? NONE_VALUE}
            onValueChange={(v) => update('description', v)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select column…" />
            </SelectTrigger>
            <SelectContent>{headerOptions}</SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Type Column</Label>
          <Select
            value={mapping.type ?? NONE_VALUE}
            onValueChange={(v) => update('type', v)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select column…" />
            </SelectTrigger>
            <SelectContent>{headerOptions}</SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Category Column</Label>
          <Select
            value={mapping.category ?? NONE_VALUE}
            onValueChange={(v) => update('category', v)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select column…" />
            </SelectTrigger>
            <SelectContent>{headerOptions}</SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Date Format</Label>
          <Select
            value={dateFormat}
            onValueChange={(v) => onDateFormatChange(v as DateFormatValue)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATE_FORMATS.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Amount convention */}
      <div className="space-y-2">
        <Label>Amount Convention</Label>
        <ToggleGroup
          type="single"
          value={amountConvention}
          onValueChange={(v) => {
            if (v) onConventionChange(v as AmountConvention)
          }}
          variant="outline"
        >
          <ToggleGroupItem value="negative-expenses">
            Negative values are expenses
          </ToggleGroupItem>
          <ToggleGroupItem value="all-expenses">
            All values are expenses
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <Separator />

      {/* Preview table */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">
            Preview{' '}
            <span className="font-normal text-muted-foreground">
              (first {previewRows.length} of {uploadData.total} rows)
            </span>
          </p>
          {invalidCount > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
              <AlertTriangle className="size-3.5" />
              {invalidCount} row{invalidCount !== 1 ? 's' : ''} cannot be parsed
            </div>
          )}
        </div>

        <div className="overflow-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Type</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {previewRows.map((row, i) => {
                const valid = isRowValid(row, mapping, dateFormat)
                const type = valid
                  ? getRowType(row, mapping, amountConvention)
                  : null
                const dateVal = mapping.date
                  ? (row.values[mapping.date] ?? '—')
                  : '—'
                const amountVal = mapping.amount
                  ? (row.values[mapping.amount] ?? '—')
                  : '—'
                const descVal = mapping.description
                  ? (row.values[mapping.description] ?? '')
                  : ''

                return (
                  <TableRow
                    key={i}
                    className={
                      !valid && mapping.date && mapping.amount
                        ? 'bg-destructive/5'
                        : undefined
                    }
                  >
                    <TableCell className="font-mono text-xs">
                      <span
                        className={
                          !valid && mapping.date
                            ? 'text-destructive'
                            : undefined
                        }
                      >
                        {mapping.date
                          ? formatDisplayDate(dateVal, dateFormat)
                          : '—'}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-48 truncate text-sm">
                      {descVal || '—'}
                    </TableCell>
                    <TableCell
                      className={cn(
                        'text-right font-mono text-sm',
                        !valid && mapping.amount && 'text-destructive',
                      )}
                    >
                      {amountVal}
                    </TableCell>
                    <TableCell>
                      {type ? (
                        <Badge
                          variant={type === 'income' ? 'default' : 'secondary'}
                          className={
                            type === 'income'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                              : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                          }
                        >
                          {type}
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="text-xs">
                          Invalid
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} className="gap-2">
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <Button
          onClick={onNext}
          disabled={!canProceed || isPreparing}
          className="gap-2"
        >
          {isPreparing ? 'Preparing…' : 'Next'}
          {!isPreparing && <ArrowRight className="size-4" />}
        </Button>
      </div>
    </div>
  )
}
