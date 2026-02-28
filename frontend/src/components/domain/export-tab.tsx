import { useState } from 'react'
import { startOfMonth, endOfMonth } from 'date-fns'
import { Download } from 'lucide-react'
import { toast } from 'sonner'
import { toISODate } from '@/lib/dates'
import { exportTransactionsCSV } from '@/api/export'
import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/domain/date-picker'
import { Label } from '@/components/ui/label'

export function ExportTab() {
  const now = new Date()
  const [dateFrom, setDateFrom] = useState(toISODate(startOfMonth(now)))
  const [dateTo, setDateTo] = useState(toISODate(endOfMonth(now)))
  const [loading, setLoading] = useState(false)

  async function handleExport() {
    if (!dateFrom || !dateTo) {
      toast.error('Please select both start and end dates')
      return
    }

    setLoading(true)
    try {
      const blob = await exportTransactionsCSV(dateFrom, dateTo)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `export-${dateFrom}-to-${dateTo}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Export downloaded')
    } catch {
      toast.error('Failed to export transactions')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-md">
      <p className="text-sm text-muted-foreground">
        Export your transactions as a CSV file for the selected date range.
      </p>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Start Date</Label>
          <DatePicker
            value={dateFrom}
            onChange={(d) => setDateFrom(d ?? '')}
            placeholder="Select start date"
          />
        </div>

        <div className="space-y-2">
          <Label>End Date</Label>
          <DatePicker
            value={dateTo}
            onChange={(d) => setDateTo(d ?? '')}
            placeholder="Select end date"
          />
        </div>
      </div>

      <Button onClick={handleExport} disabled={loading || !dateFrom || !dateTo}>
        <Download className="mr-2 h-4 w-4" />
        {loading ? 'Exporting...' : 'Export CSV'}
      </Button>
    </div>
  )
}
