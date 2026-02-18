import { CsvWizard } from '@/components/domain/csv-wizard'

export default function ImportPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Import Transactions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Import transactions from a CSV file in three steps.
        </p>
      </div>
      <CsvWizard />
    </div>
  )
}
