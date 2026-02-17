package dto

import (
	"time"

	"github.com/google/uuid"
)

// Pagination
type Pagination struct {
	Page    int   `json:"page"`
	PerPage int   `json:"per_page"`
	Total   int64 `json:"total"`
}

type PaginatedResponse struct {
	Data       any        `json:"data"`
	Pagination Pagination `json:"pagination"`
}

// Error
type ErrorDetail struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Details string `json:"details,omitempty"`
}

type ErrorResponse struct {
	Error ErrorDetail `json:"error"`
}

// Auth
type RegisterRequest struct {
	Username     string `json:"username" validate:"required,min=3,max=50"`
	Password     string `json:"password" validate:"required,min=8,max=128"`
	DisplayName  string `json:"display_name" validate:"required,max=100"`
	BaseCurrency string `json:"base_currency" validate:"required,len=3"`
	InviteCode   string `json:"invite_code" validate:"required"`
}

type LoginRequest struct {
	Username string `json:"username" validate:"required"`
	Password string `json:"password" validate:"required"`
}

type RefreshRequest struct {
	RefreshToken string `json:"refresh_token" validate:"required"`
}

type AuthResponse struct {
	AccessToken  string       `json:"access_token"`
	RefreshToken string       `json:"refresh_token"`
	User         UserResponse `json:"user"`
}

type UserResponse struct {
	ID           uuid.UUID `json:"id"`
	Username     string    `json:"username"`
	DisplayName  string    `json:"display_name"`
	BaseCurrency string    `json:"base_currency"`
	CreatedAt    time.Time `json:"created_at"`
}

// Account
type CreateAccountRequest struct {
	Name           string `json:"name" validate:"required,max=100"`
	Type           string `json:"type" validate:"required,oneof=bank cash credit_card savings"`
	Currency       string `json:"currency" validate:"required,len=3"`
	InitialBalance string `json:"initial_balance"` // decimal string
}

type UpdateAccountRequest struct {
	Name           string `json:"name" validate:"required,max=100"`
	Type           string `json:"type" validate:"required,oneof=bank cash credit_card savings"`
	InitialBalance string `json:"initial_balance"`
}

type AccountResponse struct {
	ID             uuid.UUID `json:"id"`
	Name           string    `json:"name"`
	Type           string    `json:"type"`
	Currency       string    `json:"currency"`
	InitialBalance string    `json:"initial_balance"`
	Balance        string    `json:"balance"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

// Category
type CreateCategoryRequest struct {
	Name     string     `json:"name" validate:"required,max=100"`
	Type     string     `json:"type" validate:"required,oneof=income expense"`
	ParentID *uuid.UUID `json:"parent_id"`
}

type UpdateCategoryRequest struct {
	Name     string     `json:"name" validate:"required,max=100"`
	ParentID *uuid.UUID `json:"parent_id"`
}

type CategoryResponse struct {
	ID        uuid.UUID          `json:"id"`
	Name      string             `json:"name"`
	Type      string             `json:"type"`
	ParentID  *uuid.UUID         `json:"parent_id"`
	Children  []CategoryResponse `json:"children,omitempty"`
	CreatedAt time.Time          `json:"created_at"`
}

// Transaction
type CreateTransactionRequest struct {
	AccountID   uuid.UUID  `json:"account_id" validate:"required"`
	CategoryID  *uuid.UUID `json:"category_id"`
	Type        string     `json:"type" validate:"required,oneof=income expense"`
	Amount      string     `json:"amount" validate:"required"`
	Description string     `json:"description"`
	Date        string     `json:"date" validate:"required"` // YYYY-MM-DD
}

type CreateTransferRequest struct {
	FromAccountID uuid.UUID `json:"from_account_id" validate:"required"`
	ToAccountID   uuid.UUID `json:"to_account_id" validate:"required"`
	Amount        string    `json:"amount" validate:"required"`
	ToAmount      string    `json:"to_amount"`  // if different currency
	ExchangeRate  string    `json:"exchange_rate"`
	Description   string    `json:"description"`
	Date          string    `json:"date" validate:"required"`
}

type UpdateTransferRequest struct {
	FromAccountID uuid.UUID `json:"from_account_id" validate:"required"`
	ToAccountID   uuid.UUID `json:"to_account_id" validate:"required"`
	Amount        string    `json:"amount" validate:"required"`
	ToAmount      string    `json:"to_amount"`
	ExchangeRate  string    `json:"exchange_rate"`
	Description   string    `json:"description"`
	Date          string    `json:"date" validate:"required"`
}

type UpdateTransactionRequest struct {
	AccountID   uuid.UUID  `json:"account_id" validate:"required"`
	CategoryID  *uuid.UUID `json:"category_id"`
	Type        string     `json:"type" validate:"required,oneof=income expense"`
	Amount      string     `json:"amount" validate:"required"`
	Description string     `json:"description"`
	Date        string     `json:"date" validate:"required"`
}

type TransactionResponse struct {
	ID           uuid.UUID  `json:"id"`
	AccountID    uuid.UUID  `json:"account_id"`
	CategoryID   *uuid.UUID `json:"category_id"`
	Type         string     `json:"type"`
	Amount       string     `json:"amount"`
	Currency     string     `json:"currency"`
	Description  string     `json:"description"`
	Date         string     `json:"date"`
	TransferID   *uuid.UUID `json:"transfer_id,omitempty"`
	ExchangeRate *string    `json:"exchange_rate,omitempty"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}

// Import
type CSVPreviewRow struct {
	Values map[string]string `json:"values"`
}

type CSVUploadResponse struct {
	Headers []string        `json:"headers"`
	Preview []CSVPreviewRow `json:"preview"`
	Total   int             `json:"total"`
}

type CSVConfirmRequest struct {
	AccountID   uuid.UUID         `json:"account_id" validate:"required"`
	Mapping     CSVColumnMapping  `json:"mapping" validate:"required"`
	Rows        []CSVPreviewRow   `json:"rows" validate:"required"`
}

type CSVColumnMapping struct {
	Date        string `json:"date" validate:"required"`
	Amount      string `json:"amount" validate:"required"`
	Description string `json:"description"`
	Type        string `json:"type"`
	Category    string `json:"category"`
}

// Reports
type SpendingByCategoryItem struct {
	CategoryID   uuid.UUID `json:"category_id"`
	CategoryName string    `json:"category_name"`
	ParentID     *uuid.UUID `json:"parent_id,omitempty"`
	Total        string    `json:"total"`
}

type MonthlyIncomeExpenseItem struct {
	Month   string `json:"month"`
	Income  string `json:"income"`
	Expense string `json:"expense"`
}

type BalanceHistoryItem struct {
	Date    string `json:"date"`
	Balance string `json:"balance"`
}

type SummaryResponse struct {
	TotalIncome  string            `json:"total_income"`
	TotalExpense string            `json:"total_expense"`
	NetIncome    string            `json:"net_income"`
	Accounts     []AccountResponse `json:"accounts"`
}

// Exchange Rate
type CreateExchangeRateRequest struct {
	FromCurrency string `json:"from_currency" validate:"required,len=3"`
	ToCurrency   string `json:"to_currency" validate:"required,len=3"`
	Rate         string `json:"rate" validate:"required"`
	Date         string `json:"date" validate:"required"`
}

type ExchangeRateResponse struct {
	ID           uuid.UUID `json:"id"`
	FromCurrency string    `json:"from_currency"`
	ToCurrency   string    `json:"to_currency"`
	Rate         string    `json:"rate"`
	Date         string    `json:"date"`
}
