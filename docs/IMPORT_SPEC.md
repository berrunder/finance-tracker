# Full CSV Import Specification

## Overview

Full-featured CSV import supporting multiple accounts, currencies, categories with subcategories, and transfer detection. Complements the existing single-account import (which moves to `/import/account`).

## CSV Format

Fixed 7-column schema. Delimiter and decimal separator are auto-detected.

| Column      | Description                                           | Required |
|-------------|-------------------------------------------------------|----------|
| date        | Transaction date (auto-detected format)               | Yes      |
| account     | Account name                                          | Yes      |
| category    | Category name, `\` separates subcategory (e.g. `Food\Home`) | No (empty for transfers) |
| total       | Amount with sign (negative = expense, positive = income) | Yes      |
| currency    | Currency code or symbol (e.g. `RUB`, `դր.`)          | Yes      |
| description | Transaction description                               | No       |
| transfer    | Target account name for transfers                     | No (empty for regular transactions) |

### Example Rows

```csv
date;account;category;total;currency;description;transfer
19.02.2026;All Airlines;Медицинские услуги;-6600,00;RUB;Чистка зубного камня;
20.02.2026;Tinkoff Black;Зарплата;27473,95;RUB;;
20.02.2026;Tinkoff Black;;-23000,00;RUB;;Вклады в Тинькове
20.02.2026;Вклады в Тинькове;;23000,00;RUB;;Tinkoff Black
10.02.2026;Unibank RUR;;-50000,00;RUB;;Unibank AMD
10.02.2026;Unibank AMD;;237500,00;դր.;;Unibank RUR
```

## Architecture

**Frontend responsibilities:** File upload, delimiter detection, CSV parsing (PapaParse), decimal separator detection, date format detection, currency string resolution UI.

**Backend responsibilities:** Receives parsed + resolved data. Creates accounts, currencies, categories. Pairs transfers. Imports transactions in batches. Reports failures.

## Auto-Detection

### Delimiter Detection

Analyze the first few lines of the raw CSV text. Test candidates: `;`, `,`, `\t`, `|`. Pick the delimiter that produces a consistent column count across rows (expecting 7 columns).

Frontend-only concern — the backend receives already-parsed row objects, so it never needs to detect the delimiter.

### Decimal Separator Detection

Analyze amount values across the file to determine if comma is a decimal separator (European: `1.000,50`) or thousands separator (US: `1,000.50`).

**Heuristic:** If an amount contains both `.` and `,`, the last one is the decimal separator. If only `,` appears and is followed by exactly 2 digits at the end, treat it as decimal. Otherwise, treat `.` as decimal.

### Date Format Detection

Try parsing dates from the first few data rows against supported formats:
- `dd.MM.yyyy`
- `yyyy-MM-dd`
- `dd/MM/yyyy`
- `MM/dd/yyyy`

Use the first format that successfully parses all sample dates. Disambiguation (e.g. `01/02/2026` could be either `dd/MM` or `MM/dd`) is resolved by checking if any date values exceed 12 in the first position (forces `dd/MM`).

## Wizard Flow (4 Steps)

### Step 1: Upload & Parse

1. User selects a CSV file (drag-and-drop or file picker). Max file size: **50 MB**. Encoding: **UTF-8 only**.
2. Frontend detects delimiter and parses the file with PapaParse.
3. Frontend detects decimal separator and date format from parsed data.
4. Frontend resolves currency strings against known currencies (code match + symbol match).
5. If any currency strings cannot be resolved, proceed to Step 2. Otherwise skip to Step 3.

Display: File name, detected delimiter, row count, detected date format, detected decimal separator.

### Step 2: Resolve Unknowns

Shown only when there are unresolved currency strings.

**Currency mapping:** For each unique unresolved currency string, show a dropdown of existing currency codes. User maps unknown strings to existing codes (e.g. `դր.` -> `AMD`).

If a needed currency doesn't exist in the system at all, user can enter a new currency code (3-letter ISO code) and name. The importer will create it during import.

"Back" returns to Step 1. "Next" proceeds to Step 3.

### Step 3: Preview & Confirm

Displays a full preview of what will be imported:

**Summary section:**
- Total rows, expenses, incomes, transfers
- New accounts to be created (name + currency + type defaults to `bank`)
- New categories to be created (with parent if subcategory)
- New currencies to be created (if any)

**Transaction table** (paginated for large files):
- Each row shows: date, account, category, amount, currency, description, type badge (Income/Expense/Transfer)
- Transfer pairs are visually grouped
- Error rows highlighted in red with error reason (e.g. "unparseable date", "amount not a number", "account-currency mismatch with existing account")

**Error rows:** Rows that fail validation are shown but excluded from import. Display count of error rows prominently.

"Back" returns to Step 1 or 2. "Import" triggers the backend call.

### Step 4: Import Results

After import completes:

**Success summary:**
- N transactions imported successfully
- N accounts created
- N categories created
- N currencies created

**Failed rows** (if any):
- Expandable table showing row number, original CSV data, and error reason
- Total failed count shown prominently

**Actions:** "Import More" resets wizard. Link to `/transactions` to view imported data.

## Backend API

### Endpoint: `POST /import/full`

Single endpoint that handles the entire import atomically (accounts, currencies, categories, then transactions in batches).

#### Request Body

```json
{
  "date_format": "dd.MM.yyyy",
  "decimal_separator": ",",
  "currency_mapping": {
    "դր.": "AMD"
  },
  "new_currencies": [
    {"code": "AMD", "name": "Armenian Dram", "symbol": "դր."}
  ],
  "rows": [
    {
      "date": "19.02.2026",
      "account": "All Airlines",
      "category": "Медицинские услуги",
      "total": "-6600,00",
      "currency": "RUB",
      "description": "Чистка зубного камня",
      "transfer": ""
    }
  ]
}
```

- `rows`: All parsed rows from the CSV (raw string values). Currency strings in rows are the original values; `currency_mapping` tells the backend how to resolve them.
- `date_format`: The detected/confirmed date format string.
- `decimal_separator`: Either `,` or `.`.
- `currency_mapping`: Maps non-standard currency strings to currency codes (only for strings that didn't match a code or symbol directly).
- `new_currencies`: Currencies to create before import (code must be 3 uppercase letters).

#### Response Body

```json
{
  "imported": 150,
  "accounts_created": ["Tinkoff Black", "All Airlines"],
  "categories_created": ["Медицинские услуги", "Food > Home"],
  "currencies_created": ["AMD"],
  "failed_rows": [
    {
      "row_number": 42,
      "data": {
        "date": "invalid",
        "account": "Test",
        "category": "",
        "total": "abc",
        "currency": "RUB",
        "description": "",
        "transfer": ""
      },
      "error": "invalid date format"
    }
  ]
}
```

#### Processing Steps (Backend)

1. **Create new currencies** from `new_currencies` array.
2. **Resolve currencies:** Build a lookup map from currency code + symbol -> code. Apply `currency_mapping` overrides.
3. **Parse all rows:** For each row, parse date (using `date_format`), parse amount (using `decimal_separator`), resolve currency string to code. Collect valid rows and failed rows separately.
4. **Validate account-currency consistency:** For existing accounts, verify the row's resolved currency matches the account's currency. Mismatch = row error.
5. **Create missing accounts:** Collect unique account names not in DB. Create them with `type = "bank"` and currency from the first CSV row referencing that account.
6. **Create missing categories:** For each unique category string:
   - Split by `\` to get parent and child names.
   - Determine type (income/expense) from the amount sign of the first row using this category.
   - If parent doesn't exist, create it.
   - If child is specified and doesn't exist under parent, create it.
7. **Pair transfers:** Identify rows where `transfer` field is non-empty. Match pairs by: same date + row A's account = row B's transfer field + row A's transfer field = row B's account. Generate a shared `transfer_id` (UUID) for each pair. The row with negative amount is the source (expense) leg. Compute `exchange_rate = abs(to_amount) / abs(from_amount)` when currencies differ. Unpaired transfer rows are errors.
8. **Import transactions in batches of 1000:** Use `pgx.CopyFrom` (PostgreSQL COPY protocol). Include `transfer_id` and `exchange_rate` columns for transfer rows. Skip failed rows within a batch and continue. Collect all failed rows with error reasons.
9. **Return results.**

#### Amount Parsing

Given `decimal_separator`:
- If `,`: treat `,` as decimal point, strip `.` (thousands separator), strip spaces and currency symbols.
- If `.`: treat `.` as decimal point, strip `,` (thousands separator), strip spaces and currency symbols.
- Parse the resulting string as a float.
- The sign (positive/negative) determines the transaction type.
- Store the **absolute value** as the amount (DB constraint: amount > 0).

#### Transfer Pairing Algorithm

```
1. Collect all rows where transfer field is non-empty into a transfer_candidates list.
2. For each unmatched row A in transfer_candidates:
   a. Find row B where:
      - B.date == A.date
      - B.account == A.transfer
      - B.transfer == A.account
      - B is not already matched
   b. If found:
      - Generate a shared transfer_id UUID
      - Source leg = whichever has negative amount (type = "expense")
      - Destination leg = whichever has positive amount (type = "income")
      - If source.currency != dest.currency:
          exchange_rate = abs(dest.amount) / abs(source.amount)
      - Mark both as matched
   c. If not found:
      - Mark row A as error: "transfer pair not found"
3. Matched pairs are imported as two transactions sharing the transfer_id.
```

#### Category Resolution Algorithm

```
1. Build a map of existing categories: (name, type, parent_name) -> category_id
2. For each unique category string in the CSV:
   a. Split by "\" -> [parent_name] or [parent_name, child_name]
   b. Determine type from the amount sign of the first row using this category:
      - negative amount -> "expense"
      - positive amount -> "income"
   c. Look up parent_name + type in existing categories
   d. If not found, create the parent category
   e. If child_name exists:
      - Look up child_name + type + parent_id in existing categories
      - If not found, create the child category
   f. Store the resolved category_id for this category string
```

## Routing Changes

| Route            | Component           | Description                    |
|------------------|---------------------|--------------------------------|
| `/import/full`   | `FullImportPage`    | New full-featured import       |
| `/import/account` | `ImportPage` (current) | Old single-account import (renamed) |

Update navigation: Add "Full Import" nav entry. Rename existing "Import" to "Account Import" and change its route to `/import/account`.

## File Size & Limits

- Max upload file size: **50 MB**
- Encoding: **UTF-8** (no encoding detection)
- Batch size for DB inserts: **1000 rows**
- No duplicate detection (user responsibility)

## Error Cases

| Error                              | Handling                                      |
|------------------------------------|-----------------------------------------------|
| Unparseable date                   | Row skipped, reported in failed_rows          |
| Unparseable amount                 | Row skipped, reported in failed_rows          |
| Unresolved currency                | Blocked at Step 2 (must be mapped)            |
| Account-currency mismatch          | Row skipped, reported in failed_rows          |
| Unpaired transfer row              | Row skipped, reported in failed_rows          |
| Transfer pair with same sign       | Row skipped, reported in failed_rows          |
| Missing required field (date/account/total/currency) | Row skipped, reported in failed_rows |
| DB insert failure                  | Row skipped, reported in failed_rows (batch continues) |

## Changes to Existing Code

### Backend

- New handler: `import_full.go` with `POST /import/full` endpoint
- New service: `import_full.go` with parsing, resolution, pairing, and batch import logic
- New/updated sqlc queries: `BulkCreateTransactionsWithTransfers` (adds `transfer_id` and `exchange_rate` columns to COPY), `CreateAccountReturningID`, `CreateCategoryReturningID`, `FindAccountByName`, `FindCategoryByNameAndType`
- Update `import.go` handler: No changes needed (old import stays as-is)
- Update router: Add new route, keep old route
- Increase multipart form max size to 50 MB for the new endpoint

### Frontend

- New page: `pages/import-full.tsx`
- New components: `components/domain/full-import/` directory with step components
- New API functions: `api/import-full.ts`
- New hooks: `hooks/use-import-full.ts`
- Update router: Add `/import/full` route, change old import to `/import/account`
- Update navigation: Add "Full Import" entry, rename "Import" to "Account Import"
- PapaParse config: Use `delimiter: ""` (auto-detect)

## Non-Goals

- Duplicate transaction detection
- Encoding auto-detection (UTF-8 only)
- Flexible column mapping (fixed 7-column schema)
- Undo/rollback after successful import
- Streaming/chunked upload for very large files
