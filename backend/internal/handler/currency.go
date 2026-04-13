package handler

import (
	"errors"
	"log/slog"
	"net/http"
	"regexp"

	"github.com/go-chi/chi/v5"

	"github.com/sanches/finance-tracker-cc/backend/internal/dto"
	"github.com/sanches/finance-tracker-cc/backend/internal/handler/respond"
	"github.com/sanches/finance-tracker-cc/backend/internal/service"
)

var currencyCodeRe = regexp.MustCompile(`^[A-Z]{3}$`)

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

func (h *Currency) Create(w http.ResponseWriter, r *http.Request) {
	var req dto.CreateCurrencyRequest
	if err := decodeJSON(w, r, &req); err != nil {
		respond.Error(w, http.StatusBadRequest, "INVALID_BODY", "invalid request body")
		return
	}
	if err := validate.Struct(req); err != nil {
		respond.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", validationMessage(err))
		return
	}

	currency, err := h.svc.Create(r.Context(), req)
	if err != nil {
		if errors.Is(err, service.ErrCurrencyExists) {
			respond.Error(w, http.StatusConflict, "CURRENCY_EXISTS", err.Error())
			return
		}
		slog.Error("failed to create currency", "error", err)
		respond.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to create currency")
		return
	}
	respond.JSON(w, http.StatusCreated, currency)
}

func (h *Currency) Update(w http.ResponseWriter, r *http.Request) {
	code := chi.URLParam(r, "code")
	if !currencyCodeRe.MatchString(code) {
		respond.Error(w, http.StatusBadRequest, "INVALID_ID", "currency code must be 3 uppercase letters")
		return
	}

	var req dto.UpdateCurrencyRequest
	if err := decodeJSON(w, r, &req); err != nil {
		respond.Error(w, http.StatusBadRequest, "INVALID_BODY", "invalid request body")
		return
	}
	if err := validate.Struct(req); err != nil {
		respond.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", validationMessage(err))
		return
	}

	currency, err := h.svc.Update(r.Context(), code, req)
	if err != nil {
		if errors.Is(err, service.ErrNotFound) {
			respond.Error(w, http.StatusNotFound, "NOT_FOUND", "currency not found")
			return
		}
		slog.Error("failed to update currency", "error", err)
		respond.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to update currency")
		return
	}
	respond.JSON(w, http.StatusOK, currency)
}
