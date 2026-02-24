import { useCallback, useState } from 'react'
import Papa from 'papaparse'
import { toast } from 'sonner'
import { useAccounts } from '@/hooks/use-accounts'
import { useCurrencies } from '@/hooks/use-currencies'
import { useCategories } from '@/hooks/use-categories'
import { useImportFull } from '@/hooks/use-import'
import type {
  FullImportResponse,
  FullImportRow,
  NewCurrency,
} from '@/types/api'
import { handleMutationError } from '@/lib/form-helpers'
import type { Step } from './helpers'
import {
  detectDecimalSeparator,
  detectDelimiter,
  detectDateFormat,
  resolveCurrencyString,
} from './helpers'
import { StepIndicator } from './step-indicator'
import { StepUpload, type UploadResult } from './step-upload'
import { StepResolve } from './step-resolve'
import { StepPreview } from './step-preview'
import { StepResults } from './step-results'

export function FullImportWizard() {
  const [step, setStep] = useState<Step>(1)
  const [file, setFile] = useState<File | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null)
  const [currencyMapping, setCurrencyMapping] = useState<
    Record<string, string>
  >({})
  const [newCurrencies, setNewCurrencies] = useState<NewCurrency[]>([])
  const [importResult, setImportResult] = useState<FullImportResponse | null>(
    null,
  )
  const [importError, setImportError] = useState<string | null>(null)

  const { data: currencies = [] } = useCurrencies()
  const { data: accounts = [] } = useAccounts()
  const { data: categories = [] } = useCategories()
  const importMutation = useImportFull()

  const existingAccountNames = accounts.map((a) => a.name)
  const existingCategoryNames = categories.flatMap((c) => {
    const names = [c.name]
    if (c.children) {
      for (const child of c.children) {
        names.push(child.name)
        names.push(`${c.name}\\${child.name}`)
      }
    }
    return names
  })

  const handleFileSelect = useCallback(
    (selected: File) => {
      const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB
      if (selected.size > MAX_FILE_SIZE) {
        toast.error('File is too large. Maximum size is 50 MB.')
        return
      }

      setFile(selected)
      setImportError(null)

      const reader = new FileReader()
      reader.onload = (e) => {
        const rawText = e.target?.result as string
        if (!rawText) {
          toast.error('Failed to read file')
          return
        }

        // Detect delimiter
        const delimiter = detectDelimiter(rawText)

        // Parse with PapaParse
        const parsed = Papa.parse(rawText, {
          delimiter,
          skipEmptyLines: true,
        })

        if (
          !parsed.data ||
          parsed.data.length < 2 ||
          !Array.isArray(parsed.data[0])
        ) {
          toast.error('Failed to parse CSV file')
          return
        }

        // Skip header row, build row objects
        const dataRows = (parsed.data as string[][]).slice(1)
        const rows: FullImportRow[] = dataRows
          .filter((r) => r.some((cell) => cell.trim()))
          .map((r) => ({
            date: (r[0] || '').trim(),
            account: (r[1] || '').trim(),
            category: (r[2] || '').trim(),
            total: (r[3] || '').trim(),
            currency: (r[4] || '').trim(),
            description: (r[5] || '').trim(),
            transfer: (r[6] || '').trim(),
          }))

        // Detect decimal separator and date format
        const amounts = rows.map((r) => r.total).filter(Boolean)
        const decimalSeparator = detectDecimalSeparator(amounts)
        const dates = rows.map((r) => r.date).filter(Boolean)
        const dateFormat = detectDateFormat(dates)

        // Resolve currencies
        const uniqueCurrencies = [
          ...new Set(rows.map((r) => r.currency)),
        ].filter(Boolean)
        const resolved: Record<string, string> = {}
        const unresolved: string[] = []

        for (const cs of uniqueCurrencies) {
          const code = resolveCurrencyString(cs, currencies)
          if (code) {
            resolved[cs] = code
          } else {
            unresolved.push(cs)
          }
        }

        setUploadResult({
          fileName: selected.name,
          delimiter,
          decimalSeparator,
          dateFormat,
          rows,
          unresolvedCurrencies: unresolved,
          currencyResolutions: resolved,
        })
        setCurrencyMapping({})
        setNewCurrencies([])
      }
      reader.readAsText(selected, 'utf-8')
    },
    [currencies],
  )

  function handleUploadNext() {
    if (!uploadResult) return
    if (uploadResult.unresolvedCurrencies.length > 0) {
      setStep(2) // Need to resolve currencies
    } else {
      setStep(3) // Skip to preview
    }
  }

  function handleResolveNext() {
    setStep(3)
  }

  function handleImport() {
    if (!uploadResult) return
    setImportError(null)

    // Send original currency strings in rows; backend resolves via currency_mapping
    const fullMapping = {
      ...uploadResult.currencyResolutions,
      ...currencyMapping,
    }

    importMutation.mutate(
      {
        date_format: uploadResult.dateFormat,
        decimal_separator: uploadResult.decimalSeparator,
        currency_mapping: fullMapping,
        new_currencies: newCurrencies,
        rows: uploadResult.rows,
      },
      {
        onSuccess: (result) => {
          setImportResult(result)
          setStep(4)
        },
        onError: (err) => {
          handleMutationError(err)
          setImportError(err instanceof Error ? err.message : 'Import failed')
        },
      },
    )
  }

  function handleReset() {
    setStep(1)
    setFile(null)
    setUploadResult(null)
    setCurrencyMapping({})
    setNewCurrencies([])
    setImportResult(null)
    setImportError(null)
    importMutation.reset()
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Full Import</h1>
        <StepIndicator current={step} />
      </div>

      {step === 1 && (
        <StepUpload
          file={file}
          isDragOver={isDragOver}
          uploadResult={uploadResult}
          onFileSelect={handleFileSelect}
          onDragOver={() => setIsDragOver(true)}
          onDragLeave={() => setIsDragOver(false)}
          onNext={handleUploadNext}
        />
      )}

      {step === 2 && uploadResult && (
        <StepResolve
          unresolvedCurrencies={uploadResult.unresolvedCurrencies}
          knownCurrencies={currencies}
          currencyMapping={currencyMapping}
          newCurrencies={newCurrencies}
          onUpdateMapping={(mapping, nc) => {
            setCurrencyMapping(mapping)
            setNewCurrencies(nc)
          }}
          onBack={() => setStep(1)}
          onNext={handleResolveNext}
        />
      )}

      {step === 3 && uploadResult && (
        <StepPreview
          rows={uploadResult.rows}
          decimalSeparator={uploadResult.decimalSeparator}
          existingAccounts={existingAccountNames}
          existingCategories={existingCategoryNames}
          isLoading={importMutation.isPending}
          error={importError}
          onBack={() =>
            setStep(uploadResult.unresolvedCurrencies.length > 0 ? 2 : 1)
          }
          onImport={handleImport}
        />
      )}

      {step === 4 && importResult && (
        <StepResults result={importResult} onReset={handleReset} />
      )}
    </div>
  )
}
