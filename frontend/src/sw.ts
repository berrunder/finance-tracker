/// <reference lib="webworker" />

import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { NetworkFirst, NetworkOnly } from 'workbox-strategies'

declare let self: ServiceWorkerGlobalScope

interface SyncEvent extends ExtendableEvent {
  tag: string
}

// Auto-update: activate immediately, take control of all clients
self.addEventListener('install', () => {
  void self.skipWaiting()
})
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// Precache static assets (manifest injected by vite-plugin-pwa)
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// SPA navigation fallback — NetworkFirst with offline fallback to cached index.html
const navigationHandler = new NetworkFirst({
  cacheName: 'navigation',
  networkTimeoutSeconds: 3,
})
const apiPattern = new RegExp(`^${import.meta.env.BASE_URL}api/`)
registerRoute(
  new NavigationRoute(navigationHandler, { denylist: [apiPattern] }),
)

// API requests — never cached by service worker (app-level IndexedDB handles offline)
registerRoute(apiPattern, new NetworkOnly())

// Background Sync: when connectivity returns, tell client tabs to flush the queue
self.addEventListener(
  'sync' as keyof ServiceWorkerGlobalScopeEventMap,
  ((event: SyncEvent) => {
    if (event.tag === 'finance-tracker-sync') {
      event.waitUntil(notifyClientsToSync())
    }
  }) as EventListener,
)

async function notifyClientsToSync(): Promise<void> {
  const clients = await self.clients.matchAll({ type: 'window' })
  for (const client of clients) {
    client.postMessage({ type: 'SYNC_REQUESTED' })
  }
}
