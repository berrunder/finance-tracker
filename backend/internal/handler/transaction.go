package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/sanches/finance-tracker-cc/backend/internal/dto"
	"github.com/sanches/finance-tracker-cc/backend/internal/handler/respond"
	"github.com/sanches/finance-tracker-cc/backend/internal/middleware"
	"github.com/sanches/finance-tracker-cc/backend/internal/service"
)

type Transaction struct {
	svc *service.Transaction
}

func NewTransaction(svc *service.Transaction) *Transaction {
	return &Transaction{svc: svc}
}

func (h *Transaction) List(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserID(r.Context())
	q := r.URL.Query()

	params := service.ListTransactionsParams{
		Type:     q.Get("type"),
		DateFrom: q.Get("date_from"),
		DateTo:   q.Get("date_to"),
		Page:     1,
		PerPage:  20,
	}

	if v := q.Get("account_id"); v != "" {
		id, err := uuid.Parse(v)
		if err == nil {
			params.AccountID = &id
		}
	}
	if v := q.Get("category_id"); v != "" {
		id, err := uuid.Parse(v)
		if err == nil {
			params.CategoryID = &id
		}
	}
	if v := q.Get("page"); v != "" {
		if p, err := strconv.Atoi(v); err == nil {
			params.Page = p
		}
	}
	if v := q.Get("per_page"); v != "" {
		if p, err := strconv.Atoi(v); err == nil {
			params.PerPage = p
		}
	}

	result, err := h.svc.List(r.Context(), userID, params)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to list transactions")
		return
	}
	respond.JSON(w, http.StatusOK, result)
}

func (h *Transaction) Create(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserID(r.Context())
	var req dto.CreateTransactionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respond.Error(w, http.StatusBadRequest, "INVALID_BODY", "invalid request body")
		return
	}
	if err := validate.Struct(req); err != nil {
		respond.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", err.Error())
		return
	}

	txn, err := h.svc.Create(r.Context(), userID, req)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}
	respond.JSON(w, http.StatusCreated, txn)
}

func (h *Transaction) CreateTransfer(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserID(r.Context())
	var req dto.CreateTransferRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respond.Error(w, http.StatusBadRequest, "INVALID_BODY", "invalid request body")
		return
	}
	if err := validate.Struct(req); err != nil {
		respond.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", err.Error())
		return
	}

	txns, err := h.svc.CreateTransfer(r.Context(), userID, req)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}
	respond.JSON(w, http.StatusCreated, map[string]any{"data": txns})
}

func (h *Transaction) Get(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserID(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respond.Error(w, http.StatusBadRequest, "INVALID_ID", "invalid transaction ID")
		return
	}

	txn, err := h.svc.Get(r.Context(), userID, id)
	if err != nil {
		if errors.Is(err, service.ErrNotFound) {
			respond.Error(w, http.StatusNotFound, "NOT_FOUND", "transaction not found")
			return
		}
		respond.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to get transaction")
		return
	}
	respond.JSON(w, http.StatusOK, txn)
}

func (h *Transaction) Update(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserID(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respond.Error(w, http.StatusBadRequest, "INVALID_ID", "invalid transaction ID")
		return
	}

	var req dto.UpdateTransactionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respond.Error(w, http.StatusBadRequest, "INVALID_BODY", "invalid request body")
		return
	}
	if err := validate.Struct(req); err != nil {
		respond.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", err.Error())
		return
	}

	txn, err := h.svc.Update(r.Context(), userID, id, req)
	if err != nil {
		if errors.Is(err, service.ErrNotFound) {
			respond.Error(w, http.StatusNotFound, "NOT_FOUND", "transaction not found")
			return
		}
		respond.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}
	respond.JSON(w, http.StatusOK, txn)
}

func (h *Transaction) Delete(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserID(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respond.Error(w, http.StatusBadRequest, "INVALID_ID", "invalid transaction ID")
		return
	}

	if err := h.svc.Delete(r.Context(), userID, id); err != nil {
		respond.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to delete transaction")
		return
	}
	respond.NoContent(w)
}
