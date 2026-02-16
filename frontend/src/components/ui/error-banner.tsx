import { AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ErrorBannerProps {
  message?: string
  onRetry: () => void
}

export function ErrorBanner({ message, onRetry }: ErrorBannerProps) {
  return (
    <div className="bg-destructive/10 border border-destructive rounded-md p-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-2 flex-1">
        <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
        <p className="text-sm text-destructive">
          {message || 'Failed to load data. Please try again.'}
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry} className="shrink-0">
        <RefreshCw className="h-4 w-4 mr-1" />
        Retry
      </Button>
    </div>
  )
}
