# Finance Tracker API

Base URL: `/api/v1` | Content-Type: `application/json` | Default port: `8080`

## Authentication

Protected endpoints require: `Authorization: Bearer <access_token>`

Tokens are JWT (HS256). Access tokens expire in 15 minutes, refresh tokens in 7 days. The `sub` claim contains the user UUID, `type` is either `"access"` or `"refresh"`.

### Error response format

All errors return:

```json
{"error": {"code": "ERROR_CODE", "message": "description", "details": "optional"}}
```

### Error codes

| Code | HTTP | When |
|------|------|------|
| `UNAUTHORIZED` | 401 | Missing/invalid/expired token |
| `INVALID_CREDENTIALS` | 401 | Wrong username or password |
| `INVALID_TOKEN` | 401 | Bad refresh token |
| `INVALID_INVITE_CODE` | 403 | Invalid invite code on registration |
| `USER_EXISTS` | 409 | Username taken |
| `NOT_FOUND` | 404 | Resource doesn't exist or belongs to another user |
| `HAS_CHILDREN` | 409 | Category has subcategories (can't delete) |
| `HAS_TRANSACTIONS` | 409 | Category has transactions (can't delete) |
| `VALIDATION_ERROR` | 400 | Struct validation failed |
| `INVALID_BODY` | 400 | Malformed JSON (body limit: 1 MB) |
| `INVALID_ID` | 400 | Path/query param is not a valid UUID |
| `MISSING_PARAM` | 400 | Required query parameter absent |
| `MISSING_FILE` | 400 | No file in multipart upload |
| `FILE_TOO_LARGE` | 400 | Upload exceeds 10 MB |
| `PARSE_ERROR` | 400 | CSV parsing failed |
| `IMPORT_ERROR` | 500 | CSV import failed |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

---

## Auth (public)

### `POST /auth/register`

```json
// Request
{
  "username": "string",      // required, 3-50 chars
  "password": "string",      // required, 8-128 chars
  "display_name": "string",  // required, max 100 chars
  "base_currency": "string", // required, exactly 3 chars (e.g. "USD")
  "invite_code": "string"    // required, must match a configured invite code
}

// Response 201
{
  "access_token": "string",
  "refresh_token": "string",
  "user": {
    "id": "uuid",
    "username": "string",
    "display_name": "string",
    "base_currency": "string",
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

### `POST /auth/login`

```json
// Request
{"username": "string", "password": "string"}  // both required

// Response 200 — same shape as register response
```

### `POST /auth/refresh`

```json
// Request
{"refresh_token": "string"}  // required

// Response 200 — same shape as register response
```

---

## Accounts (protected)

All monetary amounts are **decimal strings** (e.g. `"1500.50"`), never floats.

### `GET /accounts`

```json
// Response 200
{
  "data": [{
    "id": "uuid",
    "name": "string",
    "type": "bank",            // bank | cash | credit_card | savings
    "currency": "USD",
    "initial_balance": "0",
    "balance": "1500.50",      // computed: initial_balance + income - expenses
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }]
}
```

### `POST /accounts`

```json
// Request
{
  "name": "string",            // required, max 100
  "type": "string",            // required, one of: bank, cash, credit_card, savings
  "currency": "string",        // required, exactly 3 chars
  "initial_balance": "string"  // optional, defaults to "0"
}

// Response 201 — single account object (same shape as list item)
```

### `GET /accounts/{id}`

Response 200 — single account object.

### `PUT /accounts/{id}`

```json
// Request — currency cannot be changed
{
  "name": "string",            // required, max 100
  "type": "string",            // required, one of: bank, cash, credit_card, savings
  "initial_balance": "string"  // optional
}

// Response 200 — updated account object
```

### `DELETE /accounts/{id}`

Response 204 (no body).

---

## Categories (protected)

Categories form a tree (one level of nesting via `parent_id`). Each category is typed as `income` or `expense`.

### `GET /categories`

Returns the full tree. Root categories include a `children` array.

```json
// Response 200
{
  "data": [{
    "id": "uuid",
    "name": "Food",
    "type": "expense",
    "parent_id": null,
    "children": [{
      "id": "uuid",
      "name": "Groceries",
      "type": "expense",
      "parent_id": "uuid",
      "created_at": "2024-01-01T00:00:00Z"
    }],
    "created_at": "2024-01-01T00:00:00Z"
  }]
}
```

### `POST /categories`

```json
// Request
{
  "name": "string",    // required, max 100
  "type": "string",    // required, one of: income, expense
  "parent_id": "uuid"  // optional, null for root category
}

// Response 201 — single category object (no children array)
```

### `PUT /categories/{id}`

```json
// Request — type cannot be changed
{
  "name": "string",    // required, max 100
  "parent_id": "uuid"  // optional
}

// Response 200 — updated category object
```

### `DELETE /categories/{id}`

Response 204 (no body). Fails with `HAS_CHILDREN` or `HAS_TRANSACTIONS` if not empty.

---

## Transactions (protected)

### `GET /transactions`

Query parameters (all optional):

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `account_id` | uuid | — | Filter by account |
| `category_id` | uuid | — | Filter by category |
| `type` | string | — | `income` or `expense` |
| `date_from` | string | — | Start date `YYYY-MM-DD` |
| `date_to` | string | — | End date `YYYY-MM-DD` |
| `page` | int | 1 | Page number |
| `per_page` | int | 20 | Items per page |

```json
// Response 200
{
  "data": [{
    "id": "uuid",
    "account_id": "uuid",
    "category_id": "uuid",       // null if uncategorized
    "type": "expense",
    "amount": "42.50",
    "currency": "USD",
    "description": "string",
    "date": "2024-01-15",
    "transfer_id": "uuid",       // omitted if not a transfer
    "exchange_rate": "1.08",     // omitted if not a cross-currency transfer
    "created_at": "2024-01-15T10:00:00Z",
    "updated_at": "2024-01-15T10:00:00Z"
  }],
  "pagination": {"page": 1, "per_page": 20, "total": 150}
}
```

### `POST /transactions`

```json
// Request
{
  "account_id": "uuid",    // required
  "category_id": "uuid",   // optional
  "type": "string",        // required, one of: income, expense
  "amount": "string",      // required, decimal string
  "description": "string", // optional
  "date": "string"         // required, YYYY-MM-DD
}

// Response 201 — single transaction object
```

### `POST /transactions/transfer`

Creates two linked transactions (expense on source account, income on destination). Both share a `transfer_id`. Reports exclude transfers to avoid double-counting.

```json
// Request
{
  "from_account_id": "uuid",  // required
  "to_account_id": "uuid",    // required
  "amount": "string",         // required, amount leaving source account
  "to_amount": "string",      // optional, amount arriving (if different currency)
  "exchange_rate": "string",  // optional
  "description": "string",    // optional
  "date": "string"            // required, YYYY-MM-DD
}

// Response 201
{"data": [/* expense transaction */, /* income transaction */]}
```

### `PUT /transactions/transfer/{id}`

Atomically updates both legs of a transfer. The `{id}` can be either transaction's ID.

```json
// Request
{
  "from_account_id": "uuid",  // required, source account
  "to_account_id": "uuid",    // required, destination account
  "amount": "string",         // required, amount leaving source account
  "to_amount": "string",      // optional, amount arriving (if different currency)
  "exchange_rate": "string",  // optional
  "description": "string",    // optional, defaults to "Transfer"
  "date": "string"            // required, YYYY-MM-DD
}

// Response 200
{"data": [/* updated expense transaction */, /* updated income transaction */]}
```

Errors: `NOT_FOUND` (404) if transaction doesn't exist, `NOT_A_TRANSFER` (400) if transaction is not part of a transfer.

### `GET /transactions/{id}`

Response 200 — single transaction object.

### `PUT /transactions/{id}`

```json
// Request — same shape as POST /transactions
{
  "account_id": "uuid",
  "category_id": "uuid",
  "type": "string",
  "amount": "string",
  "description": "string",
  "date": "string"
}

// Response 200 — updated transaction object
```

### `DELETE /transactions/{id}`

Response 204 (no body). If the transaction is part of a transfer, both linked transactions are deleted.

---

## Reports (protected)

All report endpoints accept optional query parameters:

| Param | Type | Default |
|-------|------|---------|
| `date_from` | string (`YYYY-MM-DD`) | First day of current month |
| `date_to` | string (`YYYY-MM-DD`) | Today |

Transfer transactions are excluded from all reports.

### `GET /reports/spending`

Spending by category.

```json
// Response 200
{
  "data": [{
    "category_id": "uuid",
    "category_name": "Food",
    "parent_id": "uuid",      // omitted for root categories
    "total": "350.00"
  }]
}
```

### `GET /reports/income-expense`

Monthly income vs expense.

```json
// Response 200
{
  "data": [{"month": "2024-01", "income": "5000.00", "expense": "3200.00"}]
}
```

### `GET /reports/balance-history`

Daily balance for one account. Extra required parameter: `account_id` (uuid).

```json
// Response 200
{
  "data": [{"date": "2024-01-01", "balance": "1500.00"}]
}
```

### `GET /reports/summary`

Overall financial summary.

```json
// Response 200
{
  "total_income": "5000.00",
  "total_expense": "3200.00",
  "net_income": "1800.00",
  "accounts": [/* array of account objects */]
}
```

---

## Currencies (public)

### `GET /currencies`

```json
// Response 200
{
  "data": [
    {"code": "AMD", "name": "Armenian Dram", "symbol": "֏"},
    {"code": "EUR", "name": "Euro", "symbol": "€"}
  ]
}
```

---

## Exchange Rates (protected)

### `GET /exchange-rates`

```json
// Response 200
{
  "data": [{
    "id": "uuid",
    "from_currency": "USD",
    "to_currency": "EUR",
    "rate": "0.92",
    "date": "2024-01-15"
  }]
}
```

### `POST /exchange-rates`

```json
// Request
{
  "from_currency": "string",  // required, exactly 3 chars
  "to_currency": "string",    // required, exactly 3 chars
  "rate": "string",           // required, decimal string
  "date": "string"            // required, YYYY-MM-DD
}

// Response 201 — single exchange rate object
```

---

## CSV Import (protected)

Two-step process: upload for preview, then confirm to import.

### `POST /import/csv`

Content-Type: `multipart/form-data`. Form field: `file` (max 10 MB).

```json
// Response 200
{
  "headers": ["Date", "Amount", "Description"],
  "preview": [{"values": {"Date": "2024-01-01", "Amount": "100.00", "Description": "Purchase"}}],
  "total": 150
}
```

### `POST /import/csv/confirm`

```json
// Request
{
  "account_id": "uuid",  // required, target account
  "mapping": {            // required, maps CSV columns to fields
    "date": "Date",           // required
    "amount": "Amount",       // required
    "description": "Description",  // optional
    "type": "Type",                // optional
    "category": "Category"         // optional
  },
  "rows": [               // required, rows from preview response
    {"values": {"Date": "2024-01-01", "Amount": "100.00", "Description": "Purchase"}}
  ]
}

// Response 200
{"imported": 150}
```
