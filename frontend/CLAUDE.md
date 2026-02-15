# Frontend CLAUDE.md

## Stack

React 19, TypeScript, Vite, Tailwind CSS v4, shadcn/ui (new-york style, lucide icons), React Router v7, TanStack Query, React Hook Form + Zod, date-fns.

## Commands

```sh
cd frontend
npm run dev            # Dev server (proxies /api to localhost:8080)
npm run build          # Type-check + build
npm run check:types    # Type-check only
npm run lint           # ESLint
npm run format         # Prettier write
npm run format:check   # Prettier check
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
  lib/          # Utilities (constants, dates, money, validators, query-keys, etc.)
  pages/        # Route-level page components
  types/        # Shared TypeScript types
```

## Conventions

- **Path alias**: use `@/` for imports from `src/` (configured in tsconfig and vite).
- **API layer**: all HTTP calls go through `apiClient` in `api/client.ts`. Per-resource files (`api/accounts.ts`, etc.) export typed functions. Never call `fetch` directly from components.
- **Data fetching**: use TanStack Query hooks in `hooks/`. Query keys are centralized in `lib/query-keys.ts`.
- **Forms**: use React Hook Form + Zod schemas from `lib/validators.ts`. Use `@hookform/resolvers` for validation.
- **UI components**: shadcn/ui lives in `components/ui/` — don't hand-edit these. Add new ones with `npx shadcn add <component>`.
- **Domain components**: app-specific reusable components go in `components/domain/`.
- **`use-auth.ts`** uses `createElement` instead of JSX intentionally — keeping the file as `.ts` (not `.tsx`) ensures React Fast Refresh works, since Fast Refresh requires files to only export components. The file exports both `AuthProvider` (component) and `useAuth` (hook), so using `.tsx` would trigger the `react-refresh/only-export-components` lint error.
- **ESLint**: `react-refresh/only-export-components` is set to `error`. If a file exports both components and non-components, keep it as `.ts` with `createElement` or split the exports.
- **Unused vars**: prefix with `_` (enforced by ESLint rule `argsIgnorePattern: '^_'`).

## Documentation

- Architecture changes -> [docs/Architecture.md](docs/ARCHITECTURE.md)
