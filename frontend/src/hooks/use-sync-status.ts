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
import { getQueueCount } from '@/lib/sync-queue'
import { flushSyncQueue } from '@/lib/sync-engine'
import { invalidateTransactionRelated } from '@/lib/query-keys'
import {
  setOnNetworkStatus,
  clearOnNetworkStatusIf,
  isNetworkError,
} from '@/api/client'
import { checkHealth } from '@/api/health'

interface SyncStatusContextValue {
  isOnline: boolean
  pendingCount: number
  isSyncing: boolean
  isVerifying: boolean
  refreshPendingCount: () => Promise<void>
  verifyConnection: () => Promise<void>
}

const SyncStatusContext = createContext<SyncStatusContextValue>({
  isOnline: true,
  pendingCount: 0,
  isSyncing: false,
  isVerifying: false,
  refreshPendingCount: async () => {},
  verifyConnection: async () => {},
})

export function useSyncStatus(): SyncStatusContextValue {
  return useContext(SyncStatusContext)
}

export function SyncStatusProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )
  const [pendingCount, setPendingCount] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const queryClient = useQueryClient()
  const syncInProgress = useRef(false)
  const verifyInProgress = useRef(false)

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

  const verifyConnection = useCallback(async () => {
    if (verifyInProgress.current) return
    verifyInProgress.current = true
    setIsVerifying(true)
    try {
      // checkHealth() flows through apiClient → trackedFetch, which fires
      // setIsOnline via the network-status callback. We don't need to set
      // state here directly except in the network-error branch.
      await checkHealth()
    } catch (error) {
      if (!isNetworkError(error)) {
        // Server reachable but returned an error — still proves connectivity.
        setIsOnline(true)
      }
    } finally {
      verifyInProgress.current = false
      setIsVerifying(false)
    }
  }, [])

  // Wire api/client → React state. Any fetch result updates isOnline.
  useEffect(() => {
    setOnNetworkStatus(setIsOnline)
    return () => clearOnNetworkStatusIf(setIsOnline)
  }, [])

  // Browser online/offline events. The `online` event is treated as a hint —
  // we re-probe and let the fetch result be authoritative, since the event can
  // fire before the network is actually usable. The `offline` event is the
  // only signal we have for going offline, so we trust it directly.
  useEffect(() => {
    const handleOnline = () => {
      void verifyConnection()
    }
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [verifyConnection])

  // Mobile PWA: visibility/focus is the most reliable "user came back" signal.
  // Re-probe so a stale offline banner clears within ~1s of foregrounding.
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void verifyConnection()
      }
    }
    const handleFocus = () => {
      void verifyConnection()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('focus', handleFocus)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('focus', handleFocus)
    }
  }, [verifyConnection])

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
    {
      value: {
        isOnline,
        pendingCount,
        isSyncing,
        isVerifying,
        refreshPendingCount,
        verifyConnection,
      },
    },
    children,
  )
}
