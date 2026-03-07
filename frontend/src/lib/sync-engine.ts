import { apiClient, isNetworkError } from '@/api/client'
import {
  putTransaction,
  deleteOfflineTransaction,
  getOfflineTransaction,
} from './db'
import { getQueueEntries, dequeue, markFailed } from './sync-queue'
import type { Transaction } from '@/types/api'
import type { SyncQueueEntry } from './db'

type SyncResult = {
  synced: number
  failed: number
  errors: string[]
}

async function replayEntry(entry: SyncQueueEntry): Promise<void> {
  switch (entry.operation) {
    case 'create': {
      const result = await apiClient<Transaction>(entry.endpoint, {
        method: entry.method,
        body: JSON.stringify(entry.payload),
      })
      if (entry.tempId) {
        await deleteOfflineTransaction(entry.tempId)
        await putTransaction(result)
      }
      break
    }
    case 'create-transfer': {
      const result = await apiClient<{ data: Transaction[] }>(entry.endpoint, {
        method: entry.method,
        body: JSON.stringify(entry.payload),
      })
      if (entry.tempId) {
        // Remove only the two temp transactions belonging to this transfer
        const tempTx = await getOfflineTransaction(entry.tempId)
        if (tempTx) {
          await deleteOfflineTransaction(tempTx.id)
          if (tempTx.transfer_id) {
            await deleteOfflineTransaction(tempTx.transfer_id)
          }
        }
        // Store server versions
        for (const tx of result.data) {
          await putTransaction(tx)
        }
      }
      break
    }
    case 'update': {
      const result = await apiClient<Transaction>(entry.endpoint, {
        method: entry.method,
        body: JSON.stringify(entry.payload),
      })
      await putTransaction(result)
      break
    }
    case 'update-transfer': {
      const result = await apiClient<{ data: Transaction[] }>(entry.endpoint, {
        method: entry.method,
        body: JSON.stringify(entry.payload),
      })
      for (const tx of result.data) {
        await putTransaction(tx)
      }
      break
    }
    case 'delete': {
      await apiClient<void>(entry.endpoint, { method: entry.method })
      break
    }
  }
}

export async function flushSyncQueue(): Promise<SyncResult> {
  const entries = await getQueueEntries()
  const result: SyncResult = { synced: 0, failed: 0, errors: [] }

  for (const entry of entries) {
    if (entry.failed) continue

    try {
      await replayEntry(entry)
      await dequeue(entry.id!)
      result.synced++
    } catch (error) {
      if (isNetworkError(error)) {
        // Still offline — stop processing the queue
        break
      }
      // Server error (400, 404, etc.) — mark as failed
      const message = error instanceof Error ? error.message : 'Unknown error'
      await markFailed(entry.id!, message)
      result.failed++
      result.errors.push(message)
    }
  }

  return result
}

export function generateTempId(): string {
  return `temp_${crypto.randomUUID()}`
}
