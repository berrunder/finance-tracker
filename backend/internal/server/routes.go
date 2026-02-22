package server

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"

	"github.com/sanches/finance-tracker-cc/backend/internal/handler"
	"github.com/sanches/finance-tracker-cc/backend/internal/middleware"
)

func NewRouter(
	authMw *middleware.Auth,
	authH *handler.Auth,
	accountH *handler.Account,
	categoryH *handler.Category,
	transactionH *handler.Transaction,
	reportH *handler.Report,
	importH *handler.Import,
	importFullH *handler.ImportFull,
	exchangeRateH *handler.ExchangeRate,
	currencyH *handler.Currency,
	userH *handler.User,
) http.Handler {
	r := chi.NewRouter()

	r.Use(chimiddleware.Logger)
	r.Use(chimiddleware.Recoverer)
	r.Use(chimiddleware.RealIP)

	r.Route("/api/v1", func(r chi.Router) {
		// Public routes
		r.Route("/auth", func(r chi.Router) {
			r.Post("/register", authH.Register)
			r.Post("/login", authH.Login)
			r.Post("/refresh", authH.Refresh)
		})
		r.Get("/currencies", currencyH.List)

		// Protected routes
		r.Group(func(r chi.Router) {
			r.Use(authMw.Authenticate)

			r.Put("/user", userH.Update)

			r.Route("/accounts", func(r chi.Router) {
				r.Get("/", accountH.List)
				r.Post("/", accountH.Create)
				r.Get("/{id}", accountH.Get)
				r.Put("/{id}", accountH.Update)
				r.Delete("/{id}", accountH.Delete)
			})

			r.Route("/categories", func(r chi.Router) {
				r.Get("/", categoryH.List)
				r.Post("/", categoryH.Create)
				r.Put("/{id}", categoryH.Update)
				r.Delete("/{id}", categoryH.Delete)
			})

			r.Route("/transactions", func(r chi.Router) {
				r.Get("/", transactionH.List)
				r.Post("/", transactionH.Create)
				r.Post("/transfer", transactionH.CreateTransfer)
				r.Put("/transfer/{id}", transactionH.UpdateTransfer)
				r.Get("/{id}", transactionH.Get)
				r.Put("/{id}", transactionH.Update)
				r.Delete("/{id}", transactionH.Delete)
			})

			r.Route("/reports", func(r chi.Router) {
				r.Get("/spending", reportH.Spending)
				r.Get("/income-expense", reportH.IncomeExpense)
				r.Get("/balance-history", reportH.BalanceHistory)
				r.Get("/summary", reportH.Summary)
			})

			r.Route("/import", func(r chi.Router) {
				r.Post("/csv", importH.Upload)
				r.Post("/csv/confirm", importH.Confirm)
				r.Post("/full", importFullH.Execute)
			})

			r.Route("/exchange-rates", func(r chi.Router) {
				r.Get("/", exchangeRateH.List)
				r.Post("/", exchangeRateH.Create)
			})

		})
	})

	return r
}
