import { openDB, type IDBPDatabase, type DBSchema } from 'idb'
import type { Transaction, Account, Category } from '@/types/api'

export interface SyncQueueEntry {
  id?: number
  operation:
    | 'create'
    | 'update'
    | 'delete'
    | 'create-transfer'
    | 'update-transfer'
  endpoint: string
  method: 'POST' | 'PUT' | 'DELETE'
  payload?: unknown
  tempId?: string
  timestamp: number
  failed?: boolean
  error?: string
}

interface FinanceTrackerDB extends DBSchema {
  transactions: {
    key: string
    value: Transaction
    indexes: {
      'by-date': string
      'by-account': string
    }
  }
  accounts: {
    key: string
    value: Account
  }
  categories: {
    key: string
    value: Category
  }
  'sync-queue': {
    key: number
    value: SyncQueueEntry
    indexes: {
      'by-timestamp': number
      'by-temp-id': string
    }
  }
}

const DB_NAME = 'finance-tracker'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase<FinanceTrackerDB>> | null = null

export function getDB(): Promise<IDBPDatabase<FinanceTrackerDB>> {
  if (!dbPromise) {
    dbPromise = openDB<FinanceTrackerDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const txStore = db.createObjectStore('transactions', { keyPath: 'id' })
        txStore.createIndex('by-date', 'date')
        txStore.createIndex('by-account', 'account_id')

        db.createObjectStore('accounts', { keyPath: 'id' })
        db.createObjectStore('categories', { keyPath: 'id' })

        const syncStore = db.createObjectStore('sync-queue', {
          keyPath: 'id',
          autoIncrement: true,
        })
        syncStore.createIndex('by-timestamp', 'timestamp')
        syncStore.createIndex('by-temp-id', 'tempId')
      },
    })
  }
  return dbPromise
}

type DataStoreMap = {
  transactions: Transaction
  accounts: Account
  categories: Category
}

async function putAll<S extends keyof DataStoreMap>(
  store: S,
  items: DataStoreMap[S][],
): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(store, 'readwrite')
  await Promise.all([...items.map((item) => tx.store.put(item)), tx.done])
}

// --- Transaction helpers ---

export const putTransactions = (items: Transaction[]) =>
  putAll('transactions', items)

export async function putTransaction(transaction: Transaction): Promise<void> {
  const db = await getDB()
  await db.put('transactions', transaction)
}

export async function getOfflineTransaction(
  id: string,
): Promise<Transaction | undefined> {
  const db = await getDB()
  return db.get('transactions', id)
}

export async function getAllOfflineTransactions(): Promise<Transaction[]> {
  const db = await getDB()
  return db.getAll('transactions')
}

export async function deleteOfflineTransaction(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('transactions', id)
}

// --- Account helpers ---

export const putAccounts = (items: Account[]) => putAll('accounts', items)

export async function getOfflineAccount(
  id: string,
): Promise<Account | undefined> {
  const db = await getDB()
  return db.get('accounts', id)
}

export async function getAllOfflineAccounts(): Promise<Account[]> {
  const db = await getDB()
  return db.getAll('accounts')
}

// --- Category helpers ---

export const putCategories = (items: Category[]) => putAll('categories', items)

export async function getAllOfflineCategories(): Promise<Category[]> {
  const db = await getDB()
  return db.getAll('categories')
}

// --- Clear all data (on logout) ---

const ALL_STORES = [
  'transactions',
  'accounts',
  'categories',
  'sync-queue',
] as const

export async function clearAllOfflineData(): Promise<void> {
  if (typeof indexedDB === 'undefined') return
  const db = await getDB()
  const tx = db.transaction([...ALL_STORES], 'readwrite')
  await Promise.all([
    ...ALL_STORES.map((store) => tx.objectStore(store).clear()),
    tx.done,
  ])
}
