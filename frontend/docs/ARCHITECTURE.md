# Frontend Architecture

## Overview

The frontend is a client-side SPA (no SSR). In production, Nginx serves the static bundle and reverse-proxies `/api/*` to the Go backend. In development, Vite's built-in proxy does the same against `localhost:8080`.

```
Browser
  |
  |  static files + SPA fallback
  v
Nginx (or Vite dev server)
  |
  |  /api/* proxy
  v
Go Backend (:8080)
```

## Layer Architecture

The app is organized into four layers. Dependencies flow downward — pages depend on hooks and components, hooks depend on the API layer, and the API layer depends on types.

```
pages/          Route-level components (one per route)
  |
  +-- components/domain/    App-specific UI (forms, tables, filters)
  |     |
  |     +-- components/ui/  shadcn/ui primitives
  |
  +-- hooks/                Data-fetching hooks + utility hooks
        |
        +-- api/            HTTP functions (apiClient wrappers)
              |
              +-- types/    Shared TypeScript interfaces
              +-- lib/      Utilities (constants, validators, formatters)
```

### Pages (`src/pages/`)

Each page is a default-exported component mapped to a route in `App.tsx`. Pages compose domain components and hooks, manage local UI state (dialogs, filters), and handle user interactions.

Filter state on the transactions page is synced with URL search params via `useSearchParams`, so filters survive page reloads and back/forward navigation.

### Domain Components (`src/components/domain/`)

Reusable, app-specific components that encapsulate a piece of domain UI: forms, tables, filter bars, pickers. They receive data and callbacks via props — they don't fetch data themselves.

### UI Components (`src/components/ui/`)

shadcn/ui primitives (Button, Dialog, Select, etc.). These are managed by the `npx shadcn add` CLI and should not be edited by hand. Configured as `new-york` style with `zinc` base color and CSS variables for theming.

### Hooks (`src/hooks/`)

Two categories of hooks live here:

**Data-fetching hooks** — thin wrappers around TanStack Query's `useQuery`, `useInfiniteQuery`, and `useMutation`. Each resource domain (accounts, categories, transactions) has its own hook file that:

- Uses centralized query keys from `lib/query-keys.ts`
- Wires up cache invalidation on mutation success (e.g., creating a transaction invalidates `transactions`, `accounts`, and `reports` caches)
- Exports one hook per operation (`useAccounts`, `useCreateAccount`, `useDeleteAccount`, etc.)

Transactions use `useInfiniteQuery` for cursor-based pagination with a "Load more" pattern.

**Utility hooks** — non-query hooks for cross-cutting concerns:

- `use-theme.ts` — dark mode preference management
- `use-online-status.ts` — offline/online detection via `useSyncExternalStore` + browser `online`/`offline` events
- `use-keyboard-shortcuts.ts` — `useHotkey` hook for global keyboard shortcuts (mod+key format, auto-disabled on input focus)
- `use-sync-status.ts` — sync state context (pending count, syncing flag, auto-sync on reconnect + Background Sync messages)
- `use-install-prompt.ts` — captures `beforeinstallprompt` for PWA install button

### API Layer (`src/api/`)

Each resource file (`accounts.ts`, `transactions.ts`, etc.) exports plain async functions that call `apiClient` with typed request/response generics. These functions are the only place `apiClient` is called.

`apiClient` in `client.ts` is the single HTTP gateway:

- Prepends `/api/v1` to all endpoints
- Attaches the `Authorization: Bearer` header from an in-memory access token
- Handles 401 responses with automatic token refresh (with request queuing to avoid concurrent refreshes)
- Skips `Content-Type` for `FormData` bodies (CSV import)
- Throws typed `ApiError` with `status`, `code`, and `message`

### Types (`src/types/api.ts`)

All API request/response interfaces in a single file, mirroring the backend's JSON contract. Monetary values are strings (not numbers) to preserve precision.

### Lib (`src/lib/`)

Stateless utilities:

| File               | Purpose                                                 |
| ------------------ | ------------------------------------------------------- |
| `constants.ts`     | Currencies, account types, category types, storage keys |
| `validators.ts`    | Zod schemas for every form, with inferred types         |
| `error-mapping.ts` | Maps API error codes to form field errors               |
| `form-helpers.ts`  | Shared form submission error handling, submit labels    |
| `money.ts`         | `formatMoney` via `Intl.NumberFormat` + `decimal.js`    |
| `dates.ts`         | Date formatting helpers via `date-fns`                  |
| `query-keys.ts`    | Centralized TanStack Query key factory                  |
| `utils.ts`         | `cn()` utility for Tailwind class merging               |
| `db.ts`            | IndexedDB schema, CRUD helpers via `idb` library        |
| `sync-queue.ts`    | Offline mutation queue operations (enqueue, dequeue)     |
| `sync-engine.ts`   | Replays queued mutations against the API on reconnect   |

## Authentication

Auth uses a JWT access/refresh token pair:

1. **Login/Register** — API returns `access_token` + `refresh_token` + `user`. Access token is stored in a module-level variable (lost on page refresh); refresh token goes to `localStorage`.
2. **Startup** — `AuthProvider` checks for a stored refresh token and silently refreshes. Pages show a loading spinner via `isLoading` until this completes.
3. **401 Interceptor** — when any API call gets a 401, `apiClient` pauses the request, refreshes tokens, then retries. Concurrent requests queue behind the single refresh call.
4. **Auth failure** — if refresh fails, tokens are cleared and `AuthProvider` sets `user` to `null`, which triggers a redirect to `/login` via `ProtectedRoute`.

The auth state is managed through React Context (`AuthProvider` / `useAuth`) rather than TanStack Query because auth state drives routing decisions and must be available synchronously.

## Routing and Guards

Routes are defined in `App.tsx` using React Router v7:

- **`GuestRoute`** — wraps `/login` and `/register`. Redirects to `/dashboard` if already authenticated.
- **`ProtectedRoute`** — wraps all app routes. Redirects to `/login` if not authenticated. Nested under `ProtectedLayout` which provides the `AppLayout` shell with sidebar navigation.
- **`/`** redirects to `/dashboard`.

## Provider Hierarchy

```
StrictMode
  QueryClientProvider     -- TanStack Query cache
    TooltipProvider       -- Radix tooltip context
      AuthProvider        -- Auth state + token management
        SyncStatusProvider  -- Offline sync state + auto-sync on reconnect
          BrowserRouter     -- React Router
            Routes          -- Route definitions
          Toaster           -- Sonner toast notifications
```

`AuthProvider` is placed inside `QueryClientProvider` so that auth API calls (login, refresh) can use the same fetch infrastructure, but auth state itself is managed via `useState` rather than query cache. `SyncStatusProvider` sits inside `AuthProvider` (needs query client) and wraps the router so all pages can access sync state.

## Responsive Layout

`AppLayout` provides three sidebar modes:

- **Desktop** (>= 1024px) — full 256px sidebar, always visible
- **Tablet** (768–1023px) — collapsed 64px icon sidebar, expands on hover
- **Mobile** (< 768px) — hidden sidebar, accessible via hamburger menu in a fixed top bar using a Sheet (slide-over drawer)

## Styling and Theming

- Tailwind CSS v4 with the `@tailwindcss/vite` plugin (no `tailwind.config.js` — configuration is in `index.css`)
- Dark mode via `.dark` class on `<html>`, toggled by the `useTheme` hook
- Theme preference (`light` / `dark` / `system`) persisted in `localStorage`
- CSS variables for colors (shadcn/ui pattern), enabling theme switching without class changes on individual components

## Error Handling

Two strategies depending on context:

1. **Form submissions** — `handleFormSubmitError` maps `ApiError.code` to specific form field errors (e.g., `USER_EXISTS` -> username field) or a root-level server error displayed above the form.
2. **Non-form mutations** (delete, etc.) — `handleMutationError` shows a toast via Sonner with the error message.

## PWA and Offline Support

The app is an installable PWA with offline transaction CRUD and automatic sync on reconnect.

### Service Worker

A custom service worker (`src/sw.ts`) is built via `vite-plugin-pwa` in `injectManifest` mode:

- **Precache** — all static assets (JS, CSS, HTML, icons, fonts) are precached at install time
- **Navigation** — NetworkFirst strategy with offline fallback to cached `index.html` for SPA routing
- **API requests** — NetworkOnly (not cached by the SW; the app-level IndexedDB layer handles offline data)
- **Background Sync** — listens for the `sync` event and posts a `SYNC_REQUESTED` message to open client tabs

### Offline Data Layer (IndexedDB)

`lib/db.ts` defines an IndexedDB database (`finance-tracker`) via the `idb` library with four object stores:

| Store          | Purpose                               | Key            |
|----------------|---------------------------------------|----------------|
| `transactions` | Local mirror of server transactions   | `id`           |
| `accounts`     | Local mirror of accounts (read-only)  | `id`           |
| `categories`   | Local mirror of categories (read-only)| `id`           |
| `sync-queue`   | Pending offline mutations             | auto-increment |

**Read flow:** TanStack Query hooks fetch from the API when online and mirror successful responses to IndexedDB. When offline (`isNetworkError` detects a `TypeError` from `fetch`), hooks fall back to reading from IndexedDB.

**Write flow:** Mutations attempt the API call first. On network error, the mutation is saved to the `sync-queue` store and the transaction is written to IndexedDB with a temporary ID (`temp_<uuid>`). The UI updates optimistically from the local data.

### Sync Engine

`lib/sync-engine.ts` replays queued mutations against the API. `lib/sync-queue.ts` manages queue entries (enqueue, dequeue, mark failed) and registers Background Sync with the service worker.

**Trigger points:**
1. `online` window event (via `useOnlineStatus` change in `SyncStatusProvider`)
2. Background Sync API — the SW fires a `SYNC_REQUESTED` message to client tabs
3. App startup (if online and queue is non-empty)

**Sync process:**
1. Read queue entries ordered by timestamp (FIFO)
2. Replay each operation (create, update, delete, transfer variants)
3. On success: remove from queue, replace temp IDs with server-assigned IDs in IndexedDB
4. On network error: stop processing (still offline)
5. On server error (400/404): mark as failed, show error toast, keep in queue
6. After sync: invalidate TanStack Query caches, show success/failure toasts

**Edge cases for temp transactions:**
- Edit a temp transaction → merge payload into the existing create entry in the queue
- Delete a temp transaction → remove the create entry from the queue (no server call needed)

### Sync Status

`SyncStatusProvider` (context in `use-sync-status.ts`) exposes `pendingCount`, `isSyncing`, and `refreshPendingCount` to the component tree. It auto-triggers sync when connectivity returns and listens for Background Sync messages from the service worker.

### Offline UI

- `OfflineBanner` shows three states: offline (yellow, with pending count), syncing (blue, spinner), and failed items when online (red)
- Transaction rows with temp IDs show a cloud icon indicating pending sync
- Transaction form shows an "offline save" toast when saving without connectivity
- IndexedDB is cleared on logout to prevent data leaking between users

### Install Prompt

`use-install-prompt.ts` captures the `beforeinstallprompt` event. `InstallButton` in the sidebar footer shows an install button when the PWA is installable but not yet installed.

## Keyboard Shortcuts

`useHotkey(key, callback)` registers global keyboard shortcuts. Key format uses `mod+<key>` where `mod` resolves to Ctrl (Windows/Linux) or Cmd (Mac). Shortcuts are automatically suppressed when an input, textarea, select, or contenteditable element is focused.

Pages wire up their own shortcuts (e.g., `mod+n` for new transaction on the transactions page). The `Escape` key closes open modals and forms.

## Key Design Decisions

- **Strings for money** — All monetary values are strings throughout the stack. `decimal.js` is used only at the formatting/display boundary via `formatMoney`.
- **No global state library** — TanStack Query handles server state; component-local `useState` handles UI state; Context handles auth. No Redux/Zustand.
- **Access token in memory** — The access token is a module-level variable, not in `localStorage`, so it's cleared on page refresh. This is intentional — the refresh token flow restores the session.
- **Query key factory** — `lib/query-keys.ts` centralizes all cache keys, making invalidation patterns explicit and preventing stale-data bugs.
