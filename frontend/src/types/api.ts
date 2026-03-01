// Auth
export interface User {
  id: string
  username: string
  display_name: string
  base_currency: string
  created_at: string
}

export interface AuthResponse {
  access_token: string
  refresh_token: string
  user: User
}

export interface LoginRequest {
  username: string
  password: string
}

export interface RegisterRequest {
  username: string
  password: string
  display_name: string
  base_currency: string
  invite_code: string
}

export interface UpdateUserRequest {
  display_name: string
  base_currency: string
}

// Error
export interface ApiErrorDetail {
  code: string
  message: string
  details?: string
}

export interface ApiErrorResponse {
  error: ApiErrorDetail
}

// Pagination
export interface Pagination {
  page: number
  per_page: number
  total: number
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: Pagination
}

// Account
export interface Account {
  id: string
  name: string
  type: string
  currency: string
  initial_balance: string
  balance: string
  recent_tx_count: number
  created_at: string
  updated_at: string
}

export interface CreateAccountRequest {
  name: string
  type: string
  currency: string
  initial_balance: string
}

export interface UpdateAccountRequest {
  name: string
  type: string
  initial_balance: string
}

// Category
export interface Category {
  id: string
  name: string
  type: string
  parent_id: string | null
  children?: Category[]
  recent_tx_count: number
  created_at: string
}

export interface CreateCategoryRequest {
  name: string
  type: string
  parent_id?: string | null
}

export interface UpdateCategoryRequest {
  name: string
  parent_id?: string | null
}

// Transaction
export interface Transaction {
  id: string
  account_id: string
  category_id: string | null
  type: string
  amount: string
  currency: string
  description: string
  date: string
  transfer_id?: string | null
  exchange_rate?: string | null
  created_at: string
  updated_at: string
}

export interface CreateTransactionRequest {
  account_id: string
  category_id?: string | null
  type: string
  amount: string
  description: string
  date: string
}

export interface CreateTransferRequest {
  from_account_id: string
  to_account_id: string
  amount: string
  to_amount?: string
  exchange_rate?: string
  description: string
  date: string
}

export interface UpdateTransactionRequest {
  account_id: string
  category_id?: string | null
  type: string
  amount: string
  description: string
  date: string
}

export interface UpdateTransferRequest {
  from_account_id: string
  to_account_id: string
  amount: string
  to_amount?: string
  exchange_rate?: string
  description: string
  date: string
}

// Import
export interface CSVPreviewRow {
  values: Record<string, string>
}

export interface CSVUploadResponse {
  headers: string[]
  preview: CSVPreviewRow[]
  total: number
}

export interface CSVColumnMapping {
  date: string
  amount: string
  description?: string
  type?: string
  category?: string
}

export interface CSVConfirmRequest {
  account_id: string
  mapping: CSVColumnMapping
  rows: CSVPreviewRow[]
}

// Full Import
export interface FullImportRow {
  date: string
  account: string
  category: string
  total: string
  currency: string
  description: string
  transfer: string
}

export interface NewCurrency {
  code: string
  name: string
  symbol: string
}

export interface FullImportRequest {
  date_format: string
  decimal_separator: string
  currency_mapping: Record<string, string>
  new_currencies: NewCurrency[]
  rows: FullImportRow[]
}

export interface FailedRow {
  row_number: number
  data: FullImportRow
  error: string
}

export interface FullImportResponse {
  imported: number
  accounts_created: string[]
  categories_created: string[]
  currencies_created: string[]
  failed_rows: FailedRow[]
}

// Reports
export interface SpendingByCategoryItem {
  category_id: string
  category_name: string
  parent_id?: string | null
  total: string
}

export interface MonthlyIncomeExpenseItem {
  month: string
  income: string
  expense: string
}

export interface BalanceHistoryItem {
  date: string
  balance: string
}

export interface SummaryResponse {
  total_income: string
  total_expense: string
  net_income: string
  accounts: Account[]
}

// Currency
export interface Currency {
  code: string
  name: string
  symbol: string
}

// Exchange Rate
export interface ExchangeRate {
  id: string
  from_currency: string
  to_currency: string
  rate: string
  date: string
}

export interface CreateExchangeRateRequest {
  from_currency: string
  to_currency: string
  rate: string
  date: string
}
