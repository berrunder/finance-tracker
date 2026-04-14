package handler

import (
	"context"
	"crypto/subtle"
	"log/slog"
	"net/http"
	"time"

	"github.com/sanches/finance-tracker-cc/backend/internal/dto"
	"github.com/sanches/finance-tracker-cc/backend/internal/handler/respond"
	"github.com/sanches/finance-tracker-cc/backend/internal/service"
)

type ExchangeRate struct {
	svc     *service.ExchangeRate
	syncSvc *service.ExchangeRateSync
	token   string
}

func NewExchangeRate(svc *service.ExchangeRate, syncSvc *service.ExchangeRateSync, token string) *ExchangeRate {
	return &ExchangeRate{svc: svc, syncSvc: syncSvc, token: token}
}

func (h *ExchangeRate) List(w http.ResponseWriter, r *http.Request) {
	rates, err := h.svc.List(r.Context())
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to list exchange rates")
		return
	}
	respond.JSON(w, http.StatusOK, map[string]any{"data": rates})
}

func (h *ExchangeRate) Create(w http.ResponseWriter, r *http.Request) {
	var req dto.CreateExchangeRateRequest
	if err := decodeJSON(w, r, &req); err != nil {
		respond.Error(w, http.StatusBadRequest, "INVALID_BODY", "invalid request body")
		return
	}
	if err := validate.Struct(req); err != nil {
		respond.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", validationMessage(err))
		return
	}

	rate, err := h.svc.Create(r.Context(), req)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to create exchange rate")
		return
	}
	respond.JSON(w, http.StatusCreated, rate)
}

func (h *ExchangeRate) Sync(w http.ResponseWriter, r *http.Request) {
	if h.token == "" {
		respond.Error(w, http.StatusUnauthorized, "UNAUTHORIZED", "invalid or missing sync token")
		return
	}
	provided := r.Header.Get("X-Sync-Token")
	if len(provided) != len(h.token) || subtle.ConstantTimeCompare([]byte(provided), []byte(h.token)) != 1 {
		respond.Error(w, http.StatusUnauthorized, "UNAUTHORIZED", "invalid or missing sync token")
		return
	}

	// Run sync in background to avoid hitting the server's WriteTimeout.
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
		defer cancel()
		if err := h.syncSvc.Sync(ctx); err != nil {
			slog.Error("exchange rate sync failed", "error", err)
		}
	}()

	w.WriteHeader(http.StatusAccepted)
}
