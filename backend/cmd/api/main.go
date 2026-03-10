package main

import (
	"context"
	"log"
	"log/slog"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	"github.com/golang-migrate/migrate/v4/source/iofs"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/sanches/finance-tracker-cc/backend/internal/config"
	"github.com/sanches/finance-tracker-cc/backend/internal/handler"
	"github.com/sanches/finance-tracker-cc/backend/internal/middleware"
	"github.com/sanches/finance-tracker-cc/backend/internal/rateapi"
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
	importFullSvc := service.NewImportFull(queries, pool)
	exchangeRateSvc := service.NewExchangeRate(queries)
	rateFetcher := rateapi.NewClient()
	exchangeRateSyncSvc := service.NewExchangeRateSync(queries, rateFetcher)
	currencySvc := service.NewCurrency(queries)
	exportSvc := service.NewExport(queries)
	userSvc := service.NewUser(queries, pool)

	// Middleware
	authMw := middleware.NewAuth(cfg.JWTSecret)

	// Handlers
	authH := handler.NewAuth(authSvc)
	accountH := handler.NewAccount(accountSvc)
	categoryH := handler.NewCategory(categorySvc)
	transactionH := handler.NewTransaction(transactionSvc)
	reportH := handler.NewReport(reportSvc)
	importH := handler.NewImport(importSvc)
	importFullH := handler.NewImportFull(importFullSvc)
	exchangeRateH := handler.NewExchangeRate(exchangeRateSvc, exchangeRateSyncSvc, cfg.ExchangeRateSyncToken)
	currencyH := handler.NewCurrency(currencySvc)
	exportH := handler.NewExport(exportSvc)
	userH := handler.NewUser(userSvc)

	// Router
	router := server.NewRouter(authMw, authH, accountH, categoryH, transactionH, reportH, importH, importFullH, exchangeRateH, currencyH, exportH, userH)

	// Server
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	switch cfg.ExchangeRateSyncMode {
	case "background":
		go runBackgroundSync(ctx, exchangeRateSyncSvc.Sync)
	case "endpoint":
		if cfg.ExchangeRateSyncToken == "" {
			slog.Warn("EXCHANGE_RATE_SYNC_TOKEN is not set, POST /exchange-rates/sync will reject all requests")
		}
	default:
		log.Fatalf("invalid EXCHANGE_RATE_SYNC_MODE %q, must be \"background\" or \"endpoint\"", cfg.ExchangeRateSyncMode)
	}

	srv := server.New(":"+cfg.Port, router)
	if err := srv.Start(ctx); err != nil {
		log.Fatal("server error: ", err)
	}
}

func runBackgroundSync(ctx context.Context, fn func(context.Context) error) {
	run := func() {
		if err := fn(ctx); err != nil {
			slog.Error("background exchange rate sync failed", "error", err)
		}
	}

	run() // immediate first run on startup

	ticker := time.NewTicker(24 * time.Hour)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			run()
		case <-ctx.Done():
			return
		}
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
