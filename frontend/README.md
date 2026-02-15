# Finance Tracker — Frontend

Single-page application for a self-hosted personal finance tracker. Designed for 1–5 users (individual/family), fully responsive, with dark mode.

## Tech Stack

React 19, TypeScript (strict), Vite, Tailwind CSS v4, shadcn/ui, React Router v7, TanStack Query v5, React Hook Form + Zod, date-fns, decimal.js.

## Getting Started

```sh
npm install
npm run dev       # Starts Vite dev server on :5173, proxies /api to :8080
```

Or via Docker from the repo root:

```sh
make up           # Builds and starts the full stack
```

## Scripts

| Command              | Description                  |
| -------------------- | ---------------------------- |
| `npm run dev`        | Vite dev server with HMR     |
| `npm run build`      | Type-check + production build|
| `npm run check:types`| TypeScript type-check only   |
| `npm run lint`       | ESLint                       |
| `npm run format`     | Prettier (write)             |
| `npm run format:check`| Prettier (check only)       |
| `npm run preview`    | Preview production build     |

## Project Structure

```
src/
  api/            API client and per-resource modules
  components/
    ui/           shadcn/ui primitives (managed by CLI)
    domain/       App-specific components (forms, tables, filters)
    layout/       Shell, navigation, layout wrappers
  hooks/          Data-fetching hooks (TanStack Query wrappers)
  lib/            Utilities, constants, validators, query keys
  pages/          Route-level page components
  types/          Shared TypeScript types
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — layer design, auth flow, routing, error handling, key decisions

## Pages

- **Login / Register** — auth with invite codes
- **Dashboard** — overview with account balances
- **Transactions** — list, create, edit, filter transactions and transfers
- **Accounts** — manage accounts and currencies
- **Reports** — spending breakdowns
- **Import** — CSV transaction import
- **Settings** — categories, preferences
