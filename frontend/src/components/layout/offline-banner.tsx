import { AlertCircle, CloudOff, Loader2 } from 'lucide-react'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { useSyncStatus } from '@/hooks/use-sync-status'

export function OfflineBanner() {
  const isOnline = useOnlineStatus()
  const { pendingCount, isSyncing } = useSyncStatus()

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
        <span>
          Offline
          {pendingCount > 0 &&
            ` \u2014 ${pendingCount} change${pendingCount > 1 ? 's' : ''} pending sync`}
        </span>
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
