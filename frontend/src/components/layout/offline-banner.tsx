import { WifiOff } from 'lucide-react'
import { useOnlineStatus } from '@/hooks/use-online-status'

export function OfflineBanner() {
  const isOnline = useOnlineStatus()

  if (isOnline) return null

  return (
    <div className="mb-4 flex items-center gap-2 rounded-md border border-yellow-500/50 bg-yellow-500/10 px-4 py-2 text-sm text-yellow-700 dark:text-yellow-400">
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>You are offline. Showing cached data.</span>
    </div>
  )
}
