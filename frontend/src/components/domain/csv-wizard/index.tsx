import { useState } from 'react'
import { Separator } from '@/components/ui/separator'
import { useAccounts } from '@/hooks/use-accounts'
import { useUploadCSV, useConfirmImport } from '@/hooks/use-import'
import { ApiError } from '@/api/client'
import { handleMutationError } from '@/lib/form-helpers'
import type { CSVColumnMapping, CSVPreviewRow, CSVUploadResponse } from '@/types/api'

import {
  type Step,
  type AmountConvention,
  type DateFormatValue,
  applyConventionToRows,
  flipRowClassification,
  normalizeRowsForSubmit,
  parseCsvRowsFromFile,
} from './helpers'
import { StepIndicator } from './step-indicator'
import { StepUpload } from './step-upload'
import { StepMap } from './step-map'
import { StepConfirm } from './step-confirm'

export function CsvWizard() {
  const { data: accounts = [] } = useAccounts()
  const uploadMutation = useUploadCSV()
  const confirmMutation = useConfirmImport()

  // Step 1 state
  const [step, setStep] = useState<Step>(1)
  const [file, setFile] = useState<File | null>(null)
  const [accountId, setAccountId] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)

  // After upload
  const [uploadData, setUploadData] = useState<CSVUploadResponse | null>(null)

  // Step 2 state
  const [mapping, setMapping] = useState<Partial<CSVColumnMapping>>({})
  const [dateFormat, setDateFormat] = useState<DateFormatValue>('yyyy-MM-dd')
  const [amountConvention, setAmountConvention] =
    useState<AmountConvention>('negative-expenses')
  const [isPreparingRows, setIsPreparingRows] = useState(false)

  // Step 3 state
  const [modifiedRows, setModifiedRows] = useState<CSVPreviewRow[]>([])
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set())
  const [importResult, setImportResult] = useState<{ imported: number } | null>(null)
  const [confirmError, setConfirmError] = useState<string | null>(null)

  const selectedAccount = accounts.find((a) => a.id === accountId)

  // Derived from mapping — null when required fields are missing
  const fullMapping: CSVColumnMapping | null =
    mapping.date && mapping.amount
      ? {
        date: mapping.date,
        amount: mapping.amount,
        ...(mapping.description ? { description: mapping.description } : {}),
        ...(mapping.type ? { type: mapping.type } : {}),
        ...(mapping.category ? { category: mapping.category } : {}),
      }
      : null

  const handleUpload = async () => {
    if (!file) return
    setConfirmError(null)
    try {
      const data = await uploadMutation.mutateAsync(file)
      setUploadData(data)
      setMapping({})
      setStep(2)
    } catch (err) {
      handleMutationError(err)
    }
  }

  const handleToStep3 = async () => {
    if (!uploadData || !fullMapping || !file) return

    setIsPreparingRows(true)
    try {
      const parsedRows = await parseCsvRowsFromFile(file, uploadData.headers)
      const rows = applyConventionToRows(parsedRows, mapping, amountConvention)
      setModifiedRows(rows)
      setSelectedRows(new Set())
      setConfirmError(null)
      setStep(3)
    } catch (err) {
      handleMutationError(err)
    } finally {
      setIsPreparingRows(false)
    }
  }

  const handleFlipSelected = () => {
    setModifiedRows((prev) =>
      prev.map((row, i) => {
        if (!selectedRows.has(i)) return row
        return flipRowClassification(row, mapping)
      }),
    )
    setSelectedRows(new Set())
  }

  const handleConfirm = async () => {
    if (!fullMapping) return

    setConfirmError(null)
    const rowsToSubmit = normalizeRowsForSubmit(modifiedRows, fullMapping, dateFormat)

    try {
      const result = await confirmMutation.mutateAsync({
        account_id: accountId,
        mapping: fullMapping,
        rows: rowsToSubmit,
      })
      setImportResult(result)
    } catch (err) {
      if (err instanceof ApiError) {
        setConfirmError(err.message)
      } else {
        setConfirmError('Import failed. Please try again.')
      }
    }
  }

  const handleReset = () => {
    setStep(1)
    setFile(null)
    setAccountId('')
    setUploadData(null)
    setMapping({})
    setDateFormat('yyyy-MM-dd')
    setAmountConvention('negative-expenses')
    setModifiedRows([])
    setSelectedRows(new Set())
    setImportResult(null)
    setConfirmError(null)
    uploadMutation.reset()
    confirmMutation.reset()
  }

  return (
    <div className="max-w-3xl space-y-6">
      <StepIndicator current={step} />
      <Separator />

      {step === 1 && (
        <StepUpload
          file={file}
          accountId={accountId}
          isDragOver={isDragOver}
          isLoading={uploadMutation.isPending}
          accounts={accounts}
          onFileChange={setFile}
          onAccountChange={setAccountId}
          onDragOver={setIsDragOver}
          onNext={handleUpload}
        />
      )}

      {step === 2 && uploadData && (
        <StepMap
          uploadData={uploadData}
          mapping={mapping}
          dateFormat={dateFormat}
          amountConvention={amountConvention}
          isPreparing={isPreparingRows}
          onMappingChange={setMapping}
          onDateFormatChange={setDateFormat}
          onConventionChange={setAmountConvention}
          onBack={() => setStep(1)}
          onNext={handleToStep3}
        />
      )}

      {step === 3 && fullMapping && (
        <StepConfirm
          rows={modifiedRows}
          mapping={fullMapping}
          dateFormat={dateFormat}
          accountName={selectedAccount?.name ?? accountId}
          selectedRows={selectedRows}
          isLoading={confirmMutation.isPending}
          importResult={importResult}
          confirmError={confirmError}
          onSelectionChange={setSelectedRows}
          onFlipSelected={handleFlipSelected}
          onConfirm={handleConfirm}
          onBack={() => setStep(2)}
          onReset={handleReset}
        />
      )}
    </div>
  )
}
