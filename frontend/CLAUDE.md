# Frontend CLAUDE.md

## Stack

React 19, TypeScript, Vite, Tailwind CSS v4, shadcn/ui (new-york style, lucide icons), React Router v7, TanStack Query, React Hook Form + Zod, date-fns, vite-plugin-pwa (injectManifest mode), idb (IndexedDB).

## Commands

```sh
cd frontend
npm run dev            # Dev server (proxies /api to localhost:8080)
npm run build          # Type-check + build
npm run check:types    # Type-check only
npm run lint           # ESLint
npm run format         # Prettier write
npm run format:check   # Prettier check
npm test               # Run all tests (vitest run)
```

## Project Structure

```
src/
  api/          # API client, per-resource API modules (accounts, transactions, etc.)
  components/
    ui/         # shadcn/ui primitives (do not edit manually — use `npx shadcn add`)
    domain/     # App-specific components (forms, tables, filters)
    layout/     # Shell, nav, layout wrappers
  hooks/        # Custom hooks (use-accounts, use-auth, use-transactions, etc.)
  lib/          # Utilities (constants, dates, money, validators, query-keys, db, sync-queue, sync-engine, form-helpers, expression, utils, query-string, account-groups, error-mapping, cash-flow)
  pages/        # Route-level page components
  types/        # Shared TypeScript types
  sw.ts         # Service worker (built by vite-plugin-pwa, excluded from tsconfig.app.json)
```

## Testing

- **Framework**: Vitest with jsdom environment, globals enabled.
- **Libraries**: `@testing-library/react`, `@testing-library/jest-dom` (matchers extended via `src/test/setup.ts`).
- **Test location**: Tests live in `__tests__/` subdirectories next to the code they test. Filenames end with `.test.ts` or `.test.tsx`.
- **Example**: tests for `src/lib/money.ts` go in `src/lib/__tests__/money.test.ts`.
- **Run all**: `npm test` (alias for `vitest run`).
- **Config**: Vitest is configured inline in `vite.config.ts` (no separate vitest config file).

## Verification

- After making multi-file refactoring changes in TypeScript, always run `npm run check:types` to verify there are no type errors before reporting completion.

## Conventions

- **React Compiler lint**: `react-hooks/set-state-in-effect` is an error. Don't call `setState` inside `useEffect` — use derived state or state-key patterns instead (e.g., store `{ key, value }` and derive from key mismatch).
- **Path alias**: use `@/` for imports from `src/` (configured in tsconfig and vite).
- **API layer**: all HTTP calls go through `apiClient` in `api/client.ts`. Per-resource files (`api/accounts.ts`, etc.) export typed functions. Never call `fetch` directly from components.
- **Data fetching**: use TanStack Query hooks in `hooks/`. Query keys are centralized in `lib/query-keys.ts`.
- **Forms**: use React Hook Form + Zod schemas from `lib/validators.ts`. Use `@hookform/resolvers` for validation.
- **UI components**: shadcn/ui lives in `components/ui/` — don't hand-edit these. Add new ones with `npx shadcn add <component>`.
- **Domain components**: app-specific reusable components go in `components/domain/`.
- **`use-auth.ts`** uses `createElement` instead of JSX intentionally — keeping the file as `.ts` (not `.tsx`) ensures React Fast Refresh works, since Fast Refresh requires files to only export components. The file exports both `AuthProvider` (component) and `useAuth` (hook), so using `.tsx` would trigger the `react-refresh/only-export-components` lint error.
- **ESLint**: `react-refresh/only-export-components` is set to `error`. If a file exports both components and non-components, keep it as `.ts` with `createElement` or split the exports.
- **`.tsx` component files**: Must only export React components. Move non-component exports (utility functions, constants) to `lib/` files.
- **Tests must import, not duplicate**: Test files should import functions and types from source modules. Never copy implementation code into tests. Export pure helper functions from `.ts` hook files when needed for testing.
- **Unused vars**: prefix with `_` (enforced by ESLint rule `argsIgnorePattern: '^_'`).
- When renaming or moving files in the frontend, check for fast-refresh compatibility — never rename .ts to .tsx or vice versa for hook files without verifying import chains and HMR behavior.
- ALWAYS use proper typing. NEVER use `any` or `as unknown as Type` without a very good reason and approval. If you find yourself needing to do this, stop and ask for help — there's almost always a better way.
- `isNetworkError` in `api/client.ts` must handle all major browsers: Chrome (`Failed to fetch`), Safari (`Load failed`), Firefox (`NetworkError...`). If modifying offline detection, test against all three message patterns.
- **Auth circuit breaker**: `api/client.ts` has a module-level `authFailed` flag. `clearTokens()` resets it (for logout), `setAccessToken(non-null)` resets it (for login). In error paths, call `clearTokens()` before setting `authFailed = true` to avoid the reset stomping the flag. Only activate the circuit breaker for auth errors, not network errors — this is an offline-first PWA.
- **nginx `add_header` inheritance**: a `location` block with any `add_header` drops ALL parent `add_header`s. Any `location` that sets cache/content headers must also repeat the security headers from `server {}`. Validate with `docker run --rm -v ./nginx.conf:/etc/nginx/conf.d/default.conf:ro nginx:alpine nginx -t`.

## Documentation

- Architecture changes -> [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
