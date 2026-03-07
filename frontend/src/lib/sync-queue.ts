import { getDB, type SyncQueueEntry } from './db'

async function registerBackgroundSync(): Promise<void> {
  if (!('serviceWorker' in navigator)) return

  try {
    const registration = await navigator.serviceWorker.ready
    if ('sync' in registration) {
      await (
        registration as ServiceWorkerRegistration & {
          sync: { register: (tag: string) => Promise<void> }
        }
      ).sync.register('finance-tracker-sync')
    }
  } catch {
    // Best effort — online event fallback remains active
  }
}

export async function enqueue(
  entry: Omit<SyncQueueEntry, 'id' | 'timestamp'>,
): Promise<number> {
  const db = await getDB()
  const id = await db.add('sync-queue', {
    ...entry,
    timestamp: Date.now(),
  } as SyncQueueEntry)
  void registerBackgroundSync()
  return id
}

export async function dequeue(id: number): Promise<void> {
  const db = await getDB()
  await db.delete('sync-queue', id)
}

export async function getQueueEntries(): Promise<SyncQueueEntry[]> {
  const db = await getDB()
  return db.getAllFromIndex('sync-queue', 'by-timestamp')
}

export async function getQueueCount(): Promise<number> {
  const db = await getDB()
  return db.count('sync-queue')
}

export async function markFailed(id: number, error: string): Promise<void> {
  const db = await getDB()
  const entry = await db.get('sync-queue', id)
  if (entry) {
    await db.put('sync-queue', { ...entry, failed: true, error })
  }
}

export async function getFailedTransactionIds(): Promise<string[]> {
  const db = await getDB()
  const entries = await db.getAll('sync-queue')
  const ids = new Set<string>()

  for (const entry of entries) {
    if (!entry.failed) continue

    if (entry.tempId) {
      ids.add(entry.tempId)
    }

    const txMatch = entry.endpoint.match(/^\/transactions\/([^/]+)$/)
    if (txMatch?.[1]) {
      ids.add(txMatch[1])
      continue
    }

    const transferMatch = entry.endpoint.match(
      /^\/transactions\/transfer\/([^/]+)$/,
    )
    if (transferMatch?.[1]) {
      ids.add(transferMatch[1])
    }
  }

  return Array.from(ids)
}

/**
 * Find and remove a pending create entry for a temp ID.
 * Returns the removed entry, or undefined if not found.
 * Used when deleting an offline-created transaction (no server call needed).
 */
export async function removeCreateForTempId(
  tempId: string,
): Promise<SyncQueueEntry | undefined> {
  const db = await getDB()
  const entries = await db.getAllFromIndex('sync-queue', 'by-temp-id', tempId)
  const createEntry = entries.find(
    (e) => e.operation === 'create' || e.operation === 'create-transfer',
  )
  if (createEntry?.id != null) {
    await db.delete('sync-queue', createEntry.id)
  }
  return createEntry
}

/**
 * Update the payload of a pending create entry for a temp ID.
 * Used when editing an offline-created transaction (merge into original create).
 */
export async function updateCreatePayload(
  tempId: string,
  payload: unknown,
): Promise<boolean> {
  const db = await getDB()
  const entries = await db.getAllFromIndex('sync-queue', 'by-temp-id', tempId)
  const createEntry = entries.find(
    (e) => e.operation === 'create' || e.operation === 'create-transfer',
  )
  if (createEntry?.id != null) {
    const merged = {
      ...(createEntry.payload as Record<string, unknown>),
      ...(payload as Record<string, unknown>),
    }
    await db.put('sync-queue', { ...createEntry, payload: merged })
    return true
  }
  return false
}
