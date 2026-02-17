package handler

import (
	"log/slog"
	"net/http"

	"github.com/sanches/finance-tracker-cc/backend/internal/handler/respond"
	"github.com/sanches/finance-tracker-cc/backend/internal/service"
)

type Currency struct {
	svc *service.Currency
}

func NewCurrency(svc *service.Currency) *Currency {
	return &Currency{svc: svc}
}

func (h *Currency) List(w http.ResponseWriter, r *http.Request) {
	currencies, err := h.svc.List(r.Context())
	if err != nil {
		slog.Error("failed to list currencies", "error", err)
		respond.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to list currencies")
		return
	}
	respond.JSON(w, http.StatusOK, map[string]any{"data": currencies})
}
