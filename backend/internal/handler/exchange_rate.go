package handler

import (
	"encoding/json"
	"net/http"

	"github.com/sanches/finance-tracker-cc/backend/internal/dto"
	"github.com/sanches/finance-tracker-cc/backend/internal/handler/respond"
	"github.com/sanches/finance-tracker-cc/backend/internal/service"
)

type ExchangeRate struct {
	svc *service.ExchangeRate
}

func NewExchangeRate(svc *service.ExchangeRate) *ExchangeRate {
	return &ExchangeRate{svc: svc}
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
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respond.Error(w, http.StatusBadRequest, "INVALID_BODY", "invalid request body")
		return
	}
	if err := validate.Struct(req); err != nil {
		respond.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", err.Error())
		return
	}

	rate, err := h.svc.Create(r.Context(), req)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}
	respond.JSON(w, http.StatusCreated, rate)
}
