# Frontend Specification — Finance Tracker

## Overview

Single-page application for a self-hosted personal finance tracker. Built with React + TypeScript, served as a static SPA behind Nginx which reverse-proxies `/api/*` to the Go backend. Designed for 1-5 users (individual/family), fully responsive, with dark mode support.

---

## Tech Stack

| Concern | Library | Notes |
|---|---|---|
| Framework | React 19 + Vite | SPA, no SSR |
| Language | TypeScript (strict mode) | |
| Routing | React Router v7 | Client-side routing, Nginx SPA fallback |
| Server state | TanStack Query v5 | Cache, refetch, mutations |
| Forms | React Hook Form + zod | Inline validation on blur + server error mapping |
| UI components | shadcn/ui (Radix + Tailwind) | Default neutral (zinc/slate) theme |
| Styling | Tailwind CSS v4 | |
| Charts | Recharts | Interactive charts with drill-down |
| Dates | date-fns | |
| Decimal math | decimal.js | All monetary arithmetic uses Decimal, never native floats |
| CSV preview | PapaParse | Client-side CSV parsing for import flow |
| Testing | Vitest | Unit tests for utils, API layer, auth logic |

---

## Project Structure

```
frontend/
  src/
    api/
      client.ts              -- axios/fetch wrapper with auth interceptor
      auth.ts                -- register, login, refresh
      accounts.ts            -- account CRUD
      categories.ts          -- category CRUD
      transactions.ts        -- transaction CRUD + transfers
      reports.ts             -- report endpoints
      exchange-rates.ts      -- exchange rate endpoints
      import.ts              -- CSV import endpoints
    hooks/
      use-auth.ts            -- auth context hook (login, logout, token state)
      use-accounts.ts        -- TanStack Query hooks for accounts
      use-categories.ts      -- TanStack Query hooks for categories
      use-transactions.ts    -- TanStack Query hooks for transactions
      use-reports.ts         -- TanStack Query hooks for reports
      use-import.ts          -- TanStack Query hooks for CSV import
      use-exchange-rates.ts  -- TanStack Query hooks for exchange rates
      use-theme.ts           -- dark mode hook
      use-online-status.ts   -- offline detection hook
    pages/
      login.tsx
      register.tsx
      dashboard.tsx
      transactions.tsx
      accounts.tsx
      reports.tsx
      import.tsx
      settings.tsx
    components/
      ui/                    -- shadcn/ui components
      layout/
        app-layout.tsx       -- sidebar + content area wrapper
        sidebar.tsx          -- navigation + account balances
        offline-banner.tsx   -- offline indicator
      domain/
        transaction-form.tsx         -- unified income/expense/transfer form
        transaction-table.tsx        -- transaction list with inline actions
        transaction-filters.tsx      -- filter bar (account, category, type, date range)
        account-table.tsx            -- account list table
        account-form.tsx             -- create/edit account form
        category-list.tsx            -- grouped expandable category list
        category-form.tsx            -- create/edit category form
        category-combobox.tsx        -- searchable category picker for transaction form
        dashboard-summary.tsx        -- summary cards (income, expense, net)
        dashboard-recent.tsx         -- recent transactions list
        spending-chart.tsx           -- spending by category (pie/donut)
        income-expense-chart.tsx     -- monthly income vs expense (bar chart)
        balance-history-chart.tsx    -- account balance over time (line chart)
        csv-wizard.tsx               -- multi-step CSV import wizard
        transfer-currency-fields.tsx -- linked amount/rate fields for cross-currency
    lib/
      money.ts               -- decimal.js formatting helpers
      dates.ts               -- date formatting helpers using date-fns
      validators.ts          -- zod schemas mirroring backend validation
      query-keys.ts          -- TanStack Query key constants
      error-mapping.ts       -- map backend error codes to form fields / messages
      constants.ts           -- account types, category types, etc.
    types/
      api.ts                 -- TypeScript types matching all backend DTOs
    App.tsx                  -- router + providers
    main.tsx                 -- entry point
  public/
  index.html
  vite.config.ts
  tailwind.config.ts
  tsconfig.json
  package.json
  Dockerfile                 -- multi-stage: node build -> nginx serve
  nginx.conf                 -- SPA fallback + /api proxy
```

---

## Authentication

### Flow

1. User submits login/register form.
2. Backend returns `{ access_token, refresh_token, user }`.
3. **Access token**: stored in memory (module-level variable in `api/client.ts`). Lost on page refresh — this is intentional.
4. **Refresh token**: stored in `localStorage`. Survives page reloads and tab closes.
5. On app startup, if a refresh token exists in `localStorage`, silently call `/auth/refresh` to obtain a new access token. Show a loading screen while this completes.
6. All API requests include `Authorization: Bearer <access_token>` header.

### Token Refresh Strategy — Silent 401 Retry

- When any API call returns HTTP 401, the interceptor:
  1. Pauses the failed request.
  2. Calls `/auth/refresh` with the stored refresh token.
  3. If refresh succeeds: updates the in-memory access token, retries the original request.
  4. If refresh fails (refresh token expired): clears tokens, redirects to login page.
- A request queue prevents multiple concurrent refresh calls. While a refresh is in-flight, subsequent 401s queue their retries and wait for the single refresh to complete.
- The `/auth/refresh` endpoint itself must NOT trigger the 401 interceptor (infinite loop guard).

### Registration

Registration requires an invite code to prevent unauthorized signups on the self-hosted instance.

- The invite code is configured as a backend environment variable.
- The register form has an "Invite Code" field.
- **Note**: This requires a backend change — add an `invite_code` field to the register endpoint and validate it against the env var. Document this in the spec so it's implemented when the backend is updated.

### Auth Context

A React Context (`AuthProvider`) exposes:
- `user: User | null` — current user object
- `isAuthenticated: boolean`
- `isLoading: boolean` — true while the initial refresh-on-startup is in-flight
- `login(username, password): Promise<void>`
- `register(username, password, displayName, baseCurrency, inviteCode): Promise<void>`
- `logout(): void` — clears tokens, redirects to login

### Route Protection

- Unauthenticated routes: `/login`, `/register`.
- All other routes are protected. If `!isAuthenticated && !isLoading`, redirect to `/login`.
- If `isLoading`, show a full-page skeleton/spinner.

---

## Layout & Navigation

### Sidebar Navigation

Fixed left sidebar containing:

1. **App logo/name** at the top.
2. **Navigation links**: Dashboard, Transactions, Accounts, Reports, Import, Settings.
3. **Account balances section** (bottom portion of sidebar):
   - Lists all user accounts with name, currency symbol, and current balance.
   - Clicking an account navigates to `/transactions?account_id=<id>`.
   - Balances update when account queries are invalidated (after mutations).
4. **User section** at the very bottom: display name, logout button.

### Responsive Behavior

- **Desktop (>=1024px)**: Sidebar visible, content area fills remaining width.
- **Tablet (768-1023px)**: Sidebar collapses to icons only, expands on hover or hamburger click.
- **Mobile (<768px)**: Sidebar hidden, hamburger menu in top bar opens sidebar as an overlay. Tables become vertically stacked card layouts.

### Offline Banner

- Detect online/offline status via `navigator.onLine` + `window` events (`online`/`offline`).
- When offline, show a persistent banner at the top of the content area: "You are offline. Showing cached data."
- Disable all mutation buttons (create, edit, delete) while offline.
- Banner dismisses automatically when connectivity is restored.

---

## Dark Mode

### Strategy: System Preference + Manual Override

- **Default**: Follow system preference via `prefers-color-scheme` media query.
- **Override**: User can manually toggle Light/Dark/System in Settings > Appearance.
- **Storage**: Save preference in `localStorage` as `theme: "light" | "dark" | "system"`.
- **Implementation**: Use Tailwind's `class` strategy. On app load:
  1. Read `localStorage.theme`.
  2. If `"system"` or absent, check `window.matchMedia('(prefers-color-scheme: dark)')`.
  3. Apply `dark` class to `<html>` element accordingly.
  4. Listen for system theme changes via `matchMedia.addEventListener('change', ...)`.

---

## Pages

### Login Page (`/login`)

- Centered card layout.
- Fields: username, password.
- "Log in" button with loading state.
- Link to register page.
- On success: redirect to dashboard.
- On error: show error message inline below the form (e.g., "Invalid username or password").

### Register Page (`/register`)

- Centered card layout.
- Fields: username, password, confirm password, display name, base currency (dropdown of available currencies), invite code.
- Client-side validation: username 3-50 chars, password 8+ chars, passwords match, display name required, invite code required.
- On success: redirect to dashboard (user is auto-logged-in).
- On error: map backend errors to fields (`USER_EXISTS` → username field, invalid invite code → invite code field).

### Dashboard Page (`/dashboard`)

- **Summary cards** (top row, 3 cards):
  - Total Income (current month) — green text.
  - Total Expense (current month) — red text.
  - Net Income (income - expense) — green if positive, red if negative.
  - Data from `GET /reports/summary`.
- **Account balances**: If user has multiple accounts, show a compact table/card list of accounts with balances. Each amount shown in the account's original currency.
- **Recent transactions** (below):
  - Last 10 transactions across all accounts.
  - Data from `GET /transactions?per_page=10&page=1`.
  - Each row: date, description, amount (colored by type), account name, category name.
  - "View all" link to `/transactions`.

### Transactions Page (`/transactions`)

#### Filter Bar

Horizontal bar above the transaction list with:
- **Account** dropdown (all accounts + "All Accounts" default).
- **Category** searchable combobox (same component as in forms, with "All Categories" default).
- **Type** dropdown: All / Income / Expense.
- **Date range** picker: from and to date fields. Defaults to current month.
- Filters sync to URL search params: `/transactions?account_id=xxx&category_id=xxx&type=expense&date_from=2024-01-01&date_to=2024-01-31`.
- Filters apply immediately on change (debounced for date inputs).
- A "Clear filters" button appears when any filter is active.

#### Transaction List

- Table with columns: Date, Description, Category (as "Parent > Child" if subcategory), Amount (green for income, red for expense), Account, Actions.
- **Transfer rows**: Show with a special transfer icon/badge. Description shows "Transfer: Source → Destination". No category column value.
- **Actions column**: Edit (pencil icon), Delete (trash icon).
- **Pagination**: "Load more" button at the bottom. Shows "Showing X of Y transactions". Each click loads the next page and appends to the list.
- **Mobile**: Table collapses to card layout. Each card shows date, description, amount, account, category. Swipe or tap for actions.

#### Transaction Form

Accessed via a "New Transaction" button (also via Ctrl+N shortcut). Opens as an inline form above the table or as a slide-out panel.

- **Type toggle**: Income / Expense / Transfer (segmented control). Defaults to Expense.
- **Common fields** (Income/Expense mode):
  - Account (dropdown, required).
  - Category (searchable combobox, filtered by selected type — only income categories for income, expense for expense, required).
  - Amount (decimal input, required, positive number).
  - Description (text input, optional).
  - Date (date picker, defaults to today).
- **Transfer mode fields**:
  - From Account (dropdown, required).
  - To Account (dropdown, required, excludes the selected "from" account).
  - Amount (in source account's currency).
  - If accounts have different currencies, show the cross-currency fields (see below).
  - Description (text input, optional).
  - Date (date picker, defaults to today).
- **Validation**: Inline on blur/change via zod schemas. Also map backend validation errors to fields.
- **On submit (create)**: Show loading state on button. On success, show success toast, clear form fields except account and date (for rapid entry). Stay on the form for another entry.
- **On submit (edit)**: Show loading state. On success, close form, show success toast.

#### Cross-Currency Transfer Fields

When source and destination accounts have different currencies, show three linked fields:

- **Send amount** (in source currency, e.g., "100.00 USD").
- **Receive amount** (in destination currency, e.g., "92.50 EUR").
- **Exchange rate** (e.g., "0.925").

Behavior:
- Filling send amount + receive amount → auto-compute exchange rate.
- Filling send amount + exchange rate → auto-compute receive amount.
- Filling receive amount + exchange rate → auto-compute send amount.
- Use `decimal.js` for all arithmetic to avoid precision issues.
- Show a subtle "Implied rate: 0.925 USD/EUR" label.
- When submitting to the API: send `amount` (source), `to_amount` (destination), and `exchange_rate`.

### Accounts Page (`/accounts`)

- **Table** with columns: Name, Type (badge: Bank, Cash, Credit Card, Savings), Currency, Balance (formatted with currency symbol), Actions.
- **Actions**: Edit (pencil icon), Delete (trash icon).
- **"New Account" button** at the top.
- **Create/Edit form** (modal dialog):
  - Name (text, required, max 100 chars).
  - Type (dropdown: bank, cash, credit_card, savings).
  - Currency (dropdown of available currencies — **only on create**, disabled on edit since backend doesn't allow changing currency).
  - Initial Balance (decimal input, defaults to 0).
- **Balance display**: Show in the account's own currency using `Intl.NumberFormat` with the browser's locale.

### Reports Page (`/reports`)

Shared **date range picker** at the top of the page — controls the date range for all reports on the page. Defaults to current month.

#### Spending by Category (Donut/Pie Chart)

- Data from `GET /reports/spending?date_from=...&date_to=...`.
- Donut chart showing expense proportions by category.
- Hover tooltips show category name and amount.
- **Drill-down**: Click a category segment → chart transitions to show that category's subcategories (if any). A "Back" button/breadcrumb returns to the top-level view. If the category has no subcategories, navigate to `/transactions?category_id=xxx&date_from=...&date_to=...` instead.

#### Income vs Expense (Bar Chart)

- Data from `GET /reports/income-expense?date_from=...&date_to=...`.
- Grouped bar chart: each month has a green (income) and red (expense) bar.
- Hover tooltips show month, income total, expense total, and net.
- **Drill-down**: Click a month's bar → expand an inline panel below the chart showing a daily breakdown for that month (or navigate to `/transactions?date_from=<month-start>&date_to=<month-end>`).

#### Balance History (Line Chart)

- Only shown when user selects a specific account (dropdown above the chart).
- Data from `GET /reports/balance-history?account_id=...&date_from=...&date_to=...`.
- Line chart showing balance over time.
- Hover tooltip shows date and balance.

#### Multi-Currency in Reports

- Summary report (`GET /reports/summary`) returns totals in the user's base currency.
- Show a note: "Totals converted to [base_currency] using latest available rates."
- If exchange rates are missing for some currencies, show a warning: "Exchange rates missing for [currencies]. Totals may be inaccurate." with a link to add rates.

### Import Page (`/import`)

#### Stepper Wizard (3 steps)

Visual step indicator at the top: **1. Upload** → **2. Map & Preview** → **3. Confirm**.

**Step 1 — Upload**:
- File upload drop zone (drag-and-drop or click to browse). Accepts `.csv` files only.
- Account selector dropdown (required — the account to import transactions into).
- "Next" button. Calls `POST /import/csv` with the file. On success, move to step 2 with the parsed preview data.

**Step 2 — Map & Preview**:
- **Column mapping**: For each required field (date, amount) and optional field (description, type, category), show a dropdown populated with the CSV's column headers.
- **Date format**: Auto-detect from the first few values. Show a dropdown with common formats (`YYYY-MM-DD`, `MM/DD/YYYY`, `DD/MM/YYYY`, `DD.MM.YYYY`) so the user can override if auto-detection is wrong. Preview updates live as the format changes.
- **Amount convention**: Radio buttons — "Negative values are expenses" (default) or "All values are expenses".
- **Preview table**: Show first 5-10 rows with the mapped columns. Highlight any rows that couldn't be parsed (red background).
- "Back" and "Next" buttons.

**Step 3 — Confirm**:
- Summary: "Import X transactions into [Account Name]".
- Show breakdown: Y income, Z expense transactions.
- **Bulk correction**: Checkboxes on each row. A "Flip selected to income/expense" button to fix misclassified transactions.
- "Import" button. Calls `POST /import/csv/confirm`. On success, show success message with count. "View transactions" link.
- On error, show error message with details.

### Settings Page (`/settings`)

Tabbed layout with three tabs:

**Tab: Profile**
- Display name (text input, editable).
- Base currency (dropdown, editable — affects report aggregation).
- Username (read-only, displayed for reference).
- "Save" button.

**Tab: Categories**
- Split into two sections: **Expense Categories** and **Income Categories**.
- Each section shows parent categories as expandable sections.
- Under each parent: list of child categories, indented.
- Inline action buttons: Edit (pencil), Delete (trash) on each category.
- "Add Category" button at the top of each section. Form fields: name, parent (optional dropdown of same-type parents).
- **Delete behavior**:
  - If category has children: show error "Remove subcategories first" (backend returns `HAS_CHILDREN`).
  - If category has transactions: show error "Category has transactions and cannot be deleted" (backend returns `HAS_TRANSACTIONS`).
  - Otherwise: simple confirmation dialog.

**Tab: Appearance**
- Theme selector: three options — Light, Dark, System (radio buttons or segmented control).
- Preview of the selected theme (optional, low priority).

---

## Component Behavior Details

### Searchable Category Combobox

- Uses shadcn/ui `Combobox` (Radix `Popover` + `Command`).
- Items displayed as "Parent > Child" for subcategories, "Parent" for root categories.
- Filtered by transaction type: when transaction type is "income", only show income categories; when "expense", only show expense categories.
- Supports keyboard navigation (arrow keys, Enter to select, Escape to close).
- Shows "No categories found" when search has no matches.

### Money Formatting

- All monetary values from the API are decimal strings (e.g., `"1500.50"`).
- Parse with `new Decimal(value)` from `decimal.js`.
- Format for display using `Intl.NumberFormat` with the browser's locale and the appropriate currency code:
  ```
  new Intl.NumberFormat(navigator.language, {
    style: 'currency',
    currency: currencyCode
  }).format(decimal.toNumber())
  ```
- For input fields: accept decimal string input, validate with zod `z.string().regex(/^\d+(\.\d{1,2})?$/)`.
- **Never use native `Number` for arithmetic** — only `decimal.js`.

### Date Formatting

- API sends dates as `YYYY-MM-DD` strings.
- Display using `date-fns` `format()` with locale-aware formatting from the browser's locale.
- Date picker component uses shadcn/ui date picker (Radix `Calendar`).
- Default date for new transactions: today.

### Delete Confirmations — Tiered Strategy

| Resource | Confirmation |
|---|---|
| Transaction | Simple confirmation dialog: "Delete this transaction?" with Cancel/Delete buttons |
| Category | Simple confirmation dialog: "Delete category [name]?" |
| Account | Dangerous confirmation: "Deleting [name] will permanently remove all its transactions. Type the account name to confirm:" with a text input that must match the account name |

For transfer transactions, the confirmation notes: "This will also delete the linked transfer transaction."

---

## API Client

### Base Configuration

- Base URL: `/api/v1` (relative — Nginx proxies to backend).
- All requests include `Content-Type: application/json` (except CSV upload which uses `multipart/form-data`).
- All protected requests include `Authorization: Bearer <access_token>`.

### 401 Interceptor (Token Refresh)

```
Pseudocode:

on response 401:
  if request was to /auth/refresh:
    → clear all tokens, redirect to /login (refresh token expired)
  if refresh already in progress:
    → queue this request, wait for refresh to complete, then retry
  else:
    → set refreshing = true
    → call POST /auth/refresh with stored refresh token
    → if success:
        → update in-memory access token
        → retry the original request
        → retry all queued requests
    → if failure:
        → clear all tokens, redirect to /login
    → set refreshing = false
```

### Error Handling

Backend errors arrive as `{ error: { code, message, details? } }`.

**Mutation errors** (create, update, delete): Show as toast notification (top-right, auto-dismiss after 5 seconds). For form submissions, also map known error codes to specific form fields:

| Backend Error Code | Frontend Handling |
|---|---|
| `VALIDATION_ERROR` | Map `details` to form field errors |
| `USER_EXISTS` | Set error on `username` field |
| `HAS_CHILDREN` | Show toast: "Remove subcategories first" |
| `HAS_TRANSACTIONS` | Show toast: "Category has transactions" |
| `NOT_FOUND` | Show toast: "Item not found. It may have been deleted." |
| `INVALID_CREDENTIALS` | Set error on form (general): "Invalid username or password" |

**Page load errors** (GET requests that fail): Show inline error banner in the content area with a "Retry" button.

---

## TanStack Query Configuration

### Query Keys

Namespaced and structured for targeted invalidation:

```
['accounts']                                    -- account list
['accounts', id]                                -- single account
['categories']                                  -- category tree
['transactions', { filters }]                   -- transaction list (filters in key)
['transactions', id]                            -- single transaction
['reports', 'spending', { dateFrom, dateTo }]   -- spending report
['reports', 'income-expense', { dateFrom, dateTo }]
['reports', 'balance-history', { accountId, dateFrom, dateTo }]
['reports', 'summary', { dateFrom, dateTo }]
['exchange-rates']
```

### Cache Invalidation on Mutations

| Mutation | Invalidate |
|---|---|
| Create/edit/delete transaction | `['transactions']`, `['accounts']` (balances change), `['reports']` |
| Create/edit/delete transfer | Same as transaction |
| Create/edit/delete account | `['accounts']`, `['reports', 'summary']` |
| Create/edit/delete category | `['categories']` |
| CSV import confirm | `['transactions']`, `['accounts']`, `['reports']` |
| Update user profile | `['auth']` (user object) |

### Defaults

- `staleTime`: 0 (always refetch on mount by default — data freshness matters for finance).
- `gcTime`: 5 minutes.
- `retry`: 3 with exponential backoff (TanStack Query default).
- `refetchOnWindowFocus`: true (catch updates made in other tabs).

### Optimistic Updates

- **Deletes**: Remove item from cache immediately. On error, roll back by restoring the item and showing error toast.
- **Creates and edits**: Wait for server response. Show loading state on submit button. Update cache with server response.

---

## URL State (Filter Sync)

Transaction filters sync bidirectionally with URL search params:

- On page load: read filters from URL params, populate filter bar, fetch with those filters.
- On filter change: update URL params (via `useSearchParams`), which triggers a re-fetch via TanStack Query (since filters are part of the query key).
- Report drill-down links generate URLs like `/transactions?category_id=xxx&date_from=2024-01-01&date_to=2024-01-31`.

---

## Keyboard Shortcuts

| Shortcut | Action | Context |
|---|---|---|
| `Ctrl+N` / `Cmd+N` | Open "New Transaction" form | Any page |
| `Escape` | Close modal / form / combobox dropdown | When a modal or form is open |

Shortcuts are disabled when an input field is focused (to avoid conflicts with normal typing).

---

## Responsive Breakpoints

| Breakpoint | Width | Layout |
|---|---|---|
| Mobile | < 768px | Hamburger menu, card layouts, stacked forms |
| Tablet | 768px - 1023px | Collapsed sidebar (icons), tables with horizontal scroll if needed |
| Desktop | >= 1024px | Full sidebar, full tables, side-by-side layouts |

---

## Nginx Configuration

```
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    # SPA fallback — serve index.html for all non-file routes
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API requests to backend
    location /api/ {
        proxy_pass http://backend:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Allow large CSV uploads
        client_max_body_size 10M;
    }
}
```

---

## Dockerfile (Multi-Stage)

```
# Stage 1: Build
FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Serve
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

---

## Testing Strategy

### Scope: Vitest for Utils + API Layer

Priority test targets (highest ROI, no component rendering):

1. **`lib/money.ts`** — decimal formatting, currency display, arithmetic helpers.
2. **`lib/dates.ts`** — date parsing, formatting, range utilities.
3. **`lib/validators.ts`** — zod schema validation (valid/invalid inputs for every form).
4. **`lib/error-mapping.ts`** — backend error code → form field/message mapping.
5. **`api/client.ts`** — 401 interceptor logic, request queuing during refresh, token management.
6. **`hooks/use-auth.ts`** — login/logout/refresh flow (mock API calls).

### Not in Scope (Initial Build)

- Component rendering tests (React Testing Library) — add after UI stabilizes.
- E2E tests (Playwright/Cypress) — add in polish phase.

---

## Backend Changes Required

The following backend changes are needed to support this frontend spec:

1. **Invite code for registration**: Add an `invite_code` field to `POST /auth/register`. Validate against a `INVITE_CODES` environment variable. Return a specific error code (`INVALID_INVITE_CODE`) if it doesn't match.

---

## Implementation Phases

### Phase 1 — Scaffold & Auth
- Vite + React + TypeScript project setup
- Tailwind CSS v4 + shadcn/ui initialization
- React Router with route definitions (all pages as stubs)
- API client with 401 interceptor
- Auth context + token management
- Login and register pages (functional)
- App layout with sidebar (navigation only, no account balances yet)
- Dark mode support

### Phase 2 — Core CRUD
- Accounts page (table, create/edit/delete)
- Categories settings tab (grouped list, create/edit/delete)
- Transaction page (list with filters, create/edit/delete form)
- Transfer form (including cross-currency linked fields)
- Sidebar account balances
- TanStack Query cache invalidation wiring

### Phase 3 — Dashboard & Reports
- Dashboard page (summary cards, recent transactions)
- Reports page (spending chart, income-expense chart, balance history)
- Chart drill-down interactions
- Date range picker shared across reports

### Phase 4 — Import & Polish
- CSV import wizard (3-step stepper)
- Settings page (profile tab, appearance tab)
- Skeleton loading states
- Offline banner
- Keyboard shortcuts
- Toast notifications
- Responsive refinements
- Unit tests for utils and API layer
