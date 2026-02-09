package handler

import (
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/sanches/finance-tracker-cc/backend/internal/dto"
	"github.com/sanches/finance-tracker-cc/backend/internal/handler/respond"
	"github.com/sanches/finance-tracker-cc/backend/internal/middleware"
	"github.com/sanches/finance-tracker-cc/backend/internal/service"
)

type Category struct {
	svc *service.Category
}

func NewCategory(svc *service.Category) *Category {
	return &Category{svc: svc}
}

func (h *Category) List(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserID(r.Context())
	categories, err := h.svc.List(r.Context(), userID)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to list categories")
		return
	}
	respond.JSON(w, http.StatusOK, map[string]any{"data": categories})
}

func (h *Category) Create(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserID(r.Context())
	var req dto.CreateCategoryRequest
	if err := decodeJSON(w, r, &req); err != nil {
		respond.Error(w, http.StatusBadRequest, "INVALID_BODY", "invalid request body")
		return
	}
	if err := validate.Struct(req); err != nil {
		respond.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", err.Error())
		return
	}

	cat, err := h.svc.Create(r.Context(), userID, req)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to create category")
		return
	}
	respond.JSON(w, http.StatusCreated, cat)
}

func (h *Category) Update(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserID(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respond.Error(w, http.StatusBadRequest, "INVALID_ID", "invalid category ID")
		return
	}

	var req dto.UpdateCategoryRequest
	if err := decodeJSON(w, r, &req); err != nil {
		respond.Error(w, http.StatusBadRequest, "INVALID_BODY", "invalid request body")
		return
	}
	if err := validate.Struct(req); err != nil {
		respond.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", err.Error())
		return
	}

	cat, err := h.svc.Update(r.Context(), userID, id, req)
	if err != nil {
		if errors.Is(err, service.ErrNotFound) {
			respond.Error(w, http.StatusNotFound, "NOT_FOUND", "category not found")
			return
		}
		respond.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to update category")
		return
	}
	respond.JSON(w, http.StatusOK, cat)
}

func (h *Category) Delete(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserID(r.Context())
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		respond.Error(w, http.StatusBadRequest, "INVALID_ID", "invalid category ID")
		return
	}

	if err := h.svc.Delete(r.Context(), userID, id); err != nil {
		if errors.Is(err, service.ErrCategoryHasChildren) {
			respond.Error(w, http.StatusConflict, "HAS_CHILDREN", err.Error())
			return
		}
		if errors.Is(err, service.ErrCategoryHasTransactions) {
			respond.Error(w, http.StatusConflict, "HAS_TRANSACTIONS", err.Error())
			return
		}
		respond.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to delete category")
		return
	}
	respond.NoContent(w)
}
