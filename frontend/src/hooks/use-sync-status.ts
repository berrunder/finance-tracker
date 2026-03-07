import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useOnlineStatus } from './use-online-status'
import { getQueueCount } from '@/lib/sync-queue'
import { flushSyncQueue } from '@/lib/sync-engine'
import { invalidateTransactionRelated } from '@/lib/query-keys'

interface SyncStatusContextValue {
  pendingCount: number
  isSyncing: boolean
  refreshPendingCount: () => Promise<void>
}

const SyncStatusContext = createContext<SyncStatusContextValue>({
  pendingCount: 0,
  isSyncing: false,
  refreshPendingCount: async () => {},
})

export function useSyncStatus(): SyncStatusContextValue {
  return useContext(SyncStatusContext)
}

export function SyncStatusProvider({ children }: { children: ReactNode }) {
  const [pendingCount, setPendingCount] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)
  const isOnline = useOnlineStatus()
  const queryClient = useQueryClient()
  const syncInProgress = useRef(false)

  const refreshPendingCount = useCallback(async () => {
    const count = await getQueueCount()
    setPendingCount(count)
  }, [])

  // Refresh count on mount
  useEffect(() => {
    refreshPendingCount()
  }, [refreshPendingCount])

  const sync = useCallback(async () => {
    if (syncInProgress.current) return

    const count = await getQueueCount()
    if (count === 0) return

    syncInProgress.current = true
    setIsSyncing(true)

    try {
      const result = await flushSyncQueue()

      if (result.synced > 0) {
        toast.success(
          `${result.synced} change${result.synced > 1 ? 's' : ''} synced`,
        )
        invalidateTransactionRelated(queryClient)
      }

      if (result.failed > 0) {
        toast.error(
          `${result.failed} change${result.failed > 1 ? 's' : ''} failed to sync`,
          { description: result.errors[0] },
        )
      }
    } finally {
      syncInProgress.current = false
      setIsSyncing(false)
      await refreshPendingCount()
    }
  }, [queryClient, refreshPendingCount])

  // Sync when coming back online
  useEffect(() => {
    if (!isOnline) return
    sync()
  }, [isOnline, sync])

  // Listen for Background Sync messages from service worker
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === 'SYNC_REQUESTED') {
        sync()
      }
    }

    navigator.serviceWorker?.addEventListener('message', handleMessage)
    return () => {
      navigator.serviceWorker?.removeEventListener('message', handleMessage)
    }
  }, [sync])

  return createElement(
    SyncStatusContext.Provider,
    { value: { pendingCount, isSyncing, refreshPendingCount } },
    children,
  )
}
