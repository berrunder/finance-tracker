import { type DragEvent, useRef, useCallback } from 'react'
import { Upload, FileText, ArrowRight, X } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

export interface StepUploadProps {
  file: File | null
  accountId: string
  isDragOver: boolean
  isLoading: boolean
  accounts: { id: string; name: string; currency: string }[]
  onFileChange: (file: File | null) => void
  onAccountChange: (id: string) => void
  onDragOver: (over: boolean) => void
  onNext: () => void
}

export function StepUpload({
  file,
  accountId,
  isDragOver,
  isLoading,
  accounts,
  onFileChange,
  onAccountChange,
  onDragOver,
  onNext,
}: StepUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault()
      onDragOver(false)
      const dropped = e.dataTransfer.files[0]
      if (dropped?.name.endsWith('.csv')) {
        onFileChange(dropped)
      } else {
        toast.error('Please upload a .csv file')
      }
    },
    [onFileChange, onDragOver],
  )

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFileChange(e.target.files?.[0] ?? null)
  }

  return (
    <div className="space-y-6">
      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          onDragOver(true)
        }}
        onDragLeave={() => onDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          'flex min-h-40 cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed transition-colors',
          isDragOver
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-muted-foreground/50 hover:bg-muted/30',
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleInputChange}
        />
        {file ? (
          <div className="flex items-center gap-2 text-sm font-medium">
            <FileText className="size-5 text-primary" />
            <span>{file.name}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onFileChange(null)
                if (fileInputRef.current) fileInputRef.current.value = ''
              }}
              className="ml-1 rounded p-0.5 hover:bg-muted"
            >
              <X className="size-3.5 text-muted-foreground" />
            </button>
          </div>
        ) : (
          <>
            <Upload className="size-8 text-muted-foreground" />
            <div className="text-center">
              <p className="text-sm font-medium">
                Drop a CSV file here, or click to browse
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Accepts .csv files up to 10 MB
              </p>
            </div>
          </>
        )}
      </div>

      {/* Account selector */}
      <div className="space-y-2">
        <Label>Target Account</Label>
        <Select value={accountId} onValueChange={onAccountChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select an account to import into…" />
          </SelectTrigger>
          <SelectContent>
            {accounts.map((acc) => (
              <SelectItem key={acc.id} value={acc.id}>
                {acc.name} ({acc.currency})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-end">
        <Button
          onClick={onNext}
          disabled={!file || !accountId || isLoading}
          className="gap-2"
        >
          {isLoading ? 'Uploading…' : 'Next'}
          {!isLoading && <ArrowRight className="size-4" />}
        </Button>
      </div>
    </div>
  )
}
