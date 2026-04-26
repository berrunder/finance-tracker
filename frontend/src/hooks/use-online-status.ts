import { useSyncStatus } from './use-sync-status'

export function useOnlineStatus(): boolean {
  return useSyncStatus().isOnline
}
