import { AlertCircle, CloudOff, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSyncStatus } from '@/hooks/use-sync-status'

export function OfflineBanner() {
  const { isOnline, pendingCount, isSyncing, isVerifying, verifyConnection } =
    useSyncStatus()

  if (isOnline && !isSyncing && pendingCount === 0) return null

  if (isSyncing) {
    return (
      <div className="mb-4 flex items-center gap-2 rounded-md border border-blue-500/50 bg-blue-500/10 px-4 py-2 text-sm text-blue-700 dark:text-blue-400">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
        <span>Syncing changes...</span>
      </div>
    )
  }

  if (!isOnline) {
    return (
      <div className="mb-4 flex items-center gap-2 rounded-md border border-yellow-500/50 bg-yellow-500/10 px-4 py-2 text-sm text-yellow-700 dark:text-yellow-400">
        <CloudOff className="h-4 w-4 shrink-0" />
        <span className="flex-1">
          Offline
          {pendingCount > 0 &&
            ` — ${pendingCount} change${pendingCount > 1 ? 's' : ''} pending sync`}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-yellow-700 hover:bg-yellow-500/20 hover:text-yellow-800 dark:text-yellow-400 dark:hover:text-yellow-300"
          onClick={() => void verifyConnection()}
          disabled={isVerifying}
        >
          <RefreshCw
            className={`mr-1 h-3.5 w-3.5 ${isVerifying ? 'animate-spin' : ''}`}
          />
          Retry
        </Button>
      </div>
    )
  }

  if (isOnline && pendingCount > 0) {
    return (
      <div className="mb-4 flex items-center gap-2 rounded-md border border-red-500/50 bg-red-500/10 px-4 py-2 text-sm text-red-700 dark:text-red-400">
        <AlertCircle className="h-4 w-4 shrink-0" />
        <span>
          {pendingCount} change{pendingCount > 1 ? 's' : ''} failed to sync
        </span>
      </div>
    )
  }

  return null
}
