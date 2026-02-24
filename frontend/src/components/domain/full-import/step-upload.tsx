import { useRef } from 'react'
import { Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import type { FullImportRow } from '@/types/api'
import { cn } from '@/lib/utils'
import type { DateFormatValue } from './helpers'

export interface UploadResult {
  fileName: string
  delimiter: string
  decimalSeparator: ',' | '.'
  dateFormat: DateFormatValue
  rows: FullImportRow[]
  unresolvedCurrencies: string[]
  currencyResolutions: Record<string, string>
}

interface StepUploadProps {
  file: File | null
  isDragOver: boolean
  uploadResult: UploadResult | null
  onFileSelect: (file: File) => void
  onDragOver: () => void
  onDragLeave: () => void
  onNext: () => void
}

export function StepUpload({
  file,
  isDragOver,
  uploadResult,
  onFileSelect,
  onDragOver,
  onDragLeave,
  onNext,
}: StepUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    onDragLeave()
    const dropped = e.dataTransfer.files[0]
    if (!dropped?.name.endsWith('.csv')) {
      toast.error('Please upload a .csv file')
      return
    }
    onFileSelect(dropped)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0]
    if (selected) onFileSelect(selected)
    e.target.value = ''
  }

  return (
    <div className="space-y-6">
      <div
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors',
          isDragOver
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-primary/50',
        )}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          onDragOver()
        }}
        onDragLeave={onDragLeave}
        onDrop={handleDrop}
      >
        <Upload className="mb-3 size-8 text-muted-foreground" />
        <p className="text-sm font-medium">
          {file ? file.name : 'Drop a CSV file here or click to browse'}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Max 50 MB, UTF-8 encoded
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleInputChange}
        />
      </div>

      {uploadResult && (
        <div className="rounded-lg border p-4">
          <h3 className="mb-3 text-sm font-semibold">Detected Settings</h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div className="text-muted-foreground">Delimiter</div>
            <div className="font-mono">
              {uploadResult.delimiter === '\t'
                ? 'TAB'
                : `"${uploadResult.delimiter}"`}
            </div>
            <div className="text-muted-foreground">Decimal separator</div>
            <div className="font-mono">
              &quot;{uploadResult.decimalSeparator}&quot;
            </div>
            <div className="text-muted-foreground">Date format</div>
            <div className="font-mono">{uploadResult.dateFormat}</div>
            <div className="text-muted-foreground">Data rows</div>
            <div>{uploadResult.rows.length}</div>
            {uploadResult.unresolvedCurrencies.length > 0 && (
              <>
                <div className="text-muted-foreground">
                  Unresolved currencies
                </div>
                <div className="text-amber-600 dark:text-amber-400">
                  {uploadResult.unresolvedCurrencies.join(', ')}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={onNext} disabled={!uploadResult}>
          Next
        </Button>
      </div>
    </div>
  )
}
