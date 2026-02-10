package main

import (
	"context"
	"log"
	"log/slog"
	"strings"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	"github.com/golang-migrate/migrate/v4/source/iofs"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/sanches/finance-tracker-cc/backend/internal/config"
	"github.com/sanches/finance-tracker-cc/backend/internal/handler"
	"github.com/sanches/finance-tracker-cc/backend/internal/middleware"
	"github.com/sanches/finance-tracker-cc/backend/internal/server"
	"github.com/sanches/finance-tracker-cc/backend/internal/service"
	"github.com/sanches/finance-tracker-cc/backend/internal/store"
	"github.com/sanches/finance-tracker-cc/backend/migrations"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatal("failed to load config: ", err)
	}

	// Run migrations
	if err := runMigrations(cfg.DatabaseURL); err != nil && err != migrate.ErrNoChange {
		log.Fatal("failed to run migrations: ", err)
	}
	slog.Info("migrations complete")

	// Database
	pool, err := pgxpool.New(context.Background(), cfg.DatabaseURL)
	if err != nil {
		log.Fatal("failed to connect to database: ", err)
	}
	defer pool.Close()

	queries := store.New(pool)

	// Services
	inviteCodes := parseInviteCodes(cfg.InviteCodes)
	if len(inviteCodes) == 0 {
		log.Fatal("INVITE_CODES must contain at least one valid code")
	}
	authSvc := service.NewAuth(queries, cfg.JWTSecret, inviteCodes)
	accountSvc := service.NewAccount(queries)
	categorySvc := service.NewCategory(queries)
	transactionSvc := service.NewTransaction(queries, pool)
	reportSvc := service.NewReport(queries)
	importSvc := service.NewImport(queries)
	exchangeRateSvc := service.NewExchangeRate(queries)

	// Middleware
	authMw := middleware.NewAuth(cfg.JWTSecret)

	// Handlers
	authH := handler.NewAuth(authSvc)
	accountH := handler.NewAccount(accountSvc)
	categoryH := handler.NewCategory(categorySvc)
	transactionH := handler.NewTransaction(transactionSvc)
	reportH := handler.NewReport(reportSvc)
	importH := handler.NewImport(importSvc)
	exchangeRateH := handler.NewExchangeRate(exchangeRateSvc)

	// Router
	router := server.NewRouter(authMw, authH, accountH, categoryH, transactionH, reportH, importH, exchangeRateH)

	// Server
	srv := server.New(":"+cfg.Port, router)
	if err := srv.Start(); err != nil {
		log.Fatal("server error: ", err)
	}
}

func parseInviteCodes(raw string) []string {
	var codes []string
	for _, c := range strings.Split(raw, ",") {
		if c = strings.TrimSpace(c); c != "" {
			codes = append(codes, c)
		}
	}
	return codes
}

func runMigrations(databaseURL string) error {
	d, err := iofs.New(migrations.FS, ".")
	if err != nil {
		return err
	}
	m, err := migrate.NewWithSourceInstance("iofs", d, databaseURL)
	if err != nil {
		return err
	}
	err = m.Up()
	sourceErr, dbErr := m.Close()
	if sourceErr != nil {
		return sourceErr
	}
	if dbErr != nil {
		return dbErr
	}
	return err
}
