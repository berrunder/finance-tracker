# Full CSV Import — Implementation TODO

Tracks all tasks for implementing the Full CSV Import feature per `IMPORT_SPEC.md`.

---

## Phase 1: Backend — Database & Queries

- [x] 1.1 Add new sqlc queries: `GetAccountByName` (returns account by name)
- [x] 1.2 Reuse existing `CreateAccount` query (already returns full row)
- [x] 1.3 Add new sqlc queries: `GetCategoryByNameAndType`, `GetSubcategoryByNameAndType`
- [x] 1.4 Reuse existing `CreateCategory` query (already returns full row)
- [x] 1.5 Add new sqlc queries: `GetCurrencyBySymbol` (lookup by symbol)
- [x] 1.6 Add new sqlc query: `CreateCurrency` (insert new currency)
- [x] 1.7 Add new sqlc query: `BulkCreateTransactionsFull` — COPY with all 9 columns including `transfer_id` and `exchange_rate`
- [x] 1.8 Run `make sqlc` to regenerate Go code from new queries

## Phase 2: Backend — Service Layer

- [x] 2.1 Create `internal/service/import_full.go` with the `FullImport` service struct/method
- [x] 2.2 Implement amount parsing with configurable decimal separator (`,` or `.`)
- [x] 2.3 Implement date parsing with configurable format string
- [x] 2.4 Implement currency resolution: code match → symbol match → mapping fallback
- [x] 2.5 Implement account resolution: lookup existing by name, validate currency match, collect new accounts to create
- [x] 2.6 Implement category resolution algorithm (split by `\`, determine type from amount sign of first occurrence, create parent then child if missing)
- [x] 2.7 Implement transfer pairing algorithm (match by date + complementary account names, validate signs, compute exchange rate for cross-currency)
- [x] 2.8 Implement batch insert (1000 rows per batch) using `pgx.CopyFrom` with `transfer_id` and `exchange_rate` columns
- [x] 2.9 Implement failed row collection — skip invalid rows, continue batch, aggregate errors with row numbers and reasons
- [x] 2.10 Implement top-level orchestration: create currencies → resolve currencies → parse rows → validate accounts → create accounts → resolve categories → pair transfers → batch insert → return results
- [x] 2.11 Write unit tests for amount parsing (both decimal separators, edge cases)
- [x] 2.12 Write unit tests for date parsing (all 4 formats)
- [x] 2.13 Write unit tests for transfer pairing (same currency, multi-currency, unpaired, same-sign error)
- [x] 2.14 Write unit tests for category resolution (parent only, parent+child, auto-create, existing match)

## Phase 3: Backend — Handler & Router

- [x] 3.1 Create `internal/handler/import_full.go` — define request/response DTOs
- [x] 3.2 Implement `POST /import/full` handler: parse JSON body, validate required fields, call service, return response
- [x] 3.3 Set multipart/JSON body size limit to 50 MB for this endpoint
- [x] 3.4 Register route in the router (alongside existing import routes)
- [x] 3.5 Update `backend/docs/API.md` with the new endpoint documentation

## Phase 4: Frontend — Auto-Detection Utilities

- [x] 4.1 Create `components/domain/full-import/helpers.ts`
- [x] 4.2 Implement delimiter detection: test `;`, `,`, `\t`, `|` against first N lines, pick the one giving consistent 7-column rows
- [x] 4.3 Implement decimal separator detection from amount column values (heuristic: last separator before final digits is decimal)
- [x] 4.4 Implement date format auto-detection (try 4 formats against sample dates, disambiguate dd/MM vs MM/dd)
- [x] 4.5 Implement currency string resolution against known currencies (code + symbol matching)
- [x] 4.6 Write unit tests for delimiter detection (semicolon, comma, tab, mixed)
- [x] 4.7 Write unit tests for decimal separator detection (European, US, ambiguous cases)
- [x] 4.8 Write unit tests for date format detection (all 4 formats, disambiguation)

## Phase 5: Frontend — API & Hooks

- [x] 5.1 Create `api/import-full.ts` — define TypeScript types for request/response DTOs
- [x] 5.2 Implement `importFull(data)` API function calling `POST /import/full`
- [x] 5.3 Add `useImportFull()` mutation to `hooks/use-import.ts`

## Phase 6: Frontend — Wizard UI

- [x] 6.1 Create `pages/import-full.tsx` — shell page rendering the wizard
- [x] 6.2 Create `components/domain/full-import/index.tsx` — wizard orchestrator managing steps 1–4 and shared state
- [x] 6.3 **Step 1 — Upload & Parse:**
  - [x] File drop zone / picker (accept `.csv`, max 50 MB)
  - [x] On file select: read raw text, detect delimiter, parse with PapaParse
  - [x] Detect decimal separator and date format from parsed data
  - [x] Resolve currency strings (code + symbol lookup against user's currencies)
  - [x] Display: file name, row count, detected delimiter, date format, decimal separator
  - [x] "Next" → if unresolved currencies exist go to Step 2, else skip to Step 3
- [x] 6.4 **Step 2 — Resolve Unknowns:**
  - [x] List each unique unresolved currency string with a dropdown of existing currency codes
  - [x] Option to add a new currency (code + name + symbol)
  - [x] "Back" / "Next" navigation
- [x] 6.5 **Step 3 — Preview & Confirm:**
  - [x] Summary section: total rows, expenses, incomes, transfers, new accounts, new categories, new currencies
  - [x] Paginated transaction table: date, account, category, amount, currency, description, type badge
  - [x] Visual grouping for transfer pairs
  - [x] Error rows highlighted with reason, excluded from import count
  - [x] "Back" / "Import" buttons
- [x] 6.6 **Step 4 — Import Results:**
  - [x] Success summary: imported count, accounts/categories/currencies created
  - [x] Failed rows: expandable table (row number, original data, error reason)
  - [x] "Import More" button (resets wizard), link to `/transactions`
- [x] 6.7 Step indicator component (reuse or adapt existing `StepIndicator`)

## Phase 7: Frontend — Routing & Navigation

- [x] 7.1 Add `/import/full` route to the router
- [x] 7.2 Change existing import route from `/import` to `/import/account`
- [x] 7.3 Add "Full Import" navigation entry
- [x] 7.4 Rename "Import" nav entry to "Account Import"

## Phase 8: Integration Testing & Polish

- [ ] 8.1 End-to-end test: import a sample CSV with expenses, incomes, transfers (same currency), multi-currency transfers
- [ ] 8.2 Test edge cases: unpaired transfer rows, account-currency mismatch, unknown currency with mapping, auto-create categories with subcategories
- [ ] 8.3 Test large file (1000+ rows) to verify batching works
- [ ] 8.4 Test error reporting: verify failed rows appear with correct row numbers and reasons
- [ ] 8.5 Verify old import still works at `/import/account`
- [x] 8.6 Run `npm run lint` and `npm run check:types` — fix any issues
- [x] 8.7 Run `go test ./...` — fix any issues
