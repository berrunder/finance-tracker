package handler

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/sanches/finance-tracker-cc/backend/internal/dto"
	"github.com/sanches/finance-tracker-cc/backend/internal/handler/respond"
	"github.com/sanches/finance-tracker-cc/backend/internal/middleware"
	"github.com/sanches/finance-tracker-cc/backend/internal/service"
)

type Account struct {
	svc *service.Account
}

func NewAccount(svc *service.Account) *Account {
	return &Account{svc: svc}
}

func (h *Account) List(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserID(r.Context())
	accounts, err := h.svc.List(r.Context(), userID)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to list accounts")
		return
	}
	respond.JSON(w, http.StatusOK, map[string]any{"data": accounts})
}

func (h *Account) Create(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserID(r.Context())
	var req dto.CreateAccountRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respond.Error(w, http.StatusBadRequest, "INVALID_BODY", "invalid request body")
		return
	}
	if err := validate.Struct(req); err != nil {
		respond.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", err.Error())
		return
	}

	acct, err := h.svc.Create(r.Context(), userID, req)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}
	respond.JSON(w, http.StatusCreated, acct)
}

func (h *Account) Get(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserID(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respond.Error(w, http.StatusBadRequest, "INVALID_ID", "invalid account ID")
		return
	}

	acct, err := h.svc.Get(r.Context(), userID, id)
	if err != nil {
		if errors.Is(err, service.ErrNotFound) {
			respond.Error(w, http.StatusNotFound, "NOT_FOUND", "account not found")
			return
		}
		respond.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to get account")
		return
	}
	respond.JSON(w, http.StatusOK, acct)
}

func (h *Account) Update(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserID(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respond.Error(w, http.StatusBadRequest, "INVALID_ID", "invalid account ID")
		return
	}

	var req dto.UpdateAccountRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respond.Error(w, http.StatusBadRequest, "INVALID_BODY", "invalid request body")
		return
	}
	if err := validate.Struct(req); err != nil {
		respond.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", err.Error())
		return
	}

	acct, err := h.svc.Update(r.Context(), userID, id, req)
	if err != nil {
		if errors.Is(err, service.ErrNotFound) {
			respond.Error(w, http.StatusNotFound, "NOT_FOUND", "account not found")
			return
		}
		respond.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}
	respond.JSON(w, http.StatusOK, acct)
}

func (h *Account) Delete(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserID(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respond.Error(w, http.StatusBadRequest, "INVALID_ID", "invalid account ID")
		return
	}

	if err := h.svc.Delete(r.Context(), userID, id); err != nil {
		respond.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to delete account")
		return
	}
	respond.NoContent(w)
}
