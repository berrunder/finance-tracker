package handler

import (
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/sanches/finance-tracker-cc/backend/internal/dto"
	"github.com/sanches/finance-tracker-cc/backend/internal/handler/respond"
	"github.com/sanches/finance-tracker-cc/backend/internal/middleware"
	"github.com/sanches/finance-tracker-cc/backend/internal/service"
)

type ImportFull struct {
	svc *service.ImportFull
}

func NewImportFull(svc *service.ImportFull) *ImportFull {
	return &ImportFull{svc: svc}
}

func (h *ImportFull) Execute(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserID(r.Context())

	// Use a 50 MB limit directly (decodeJSON defaults to 1 MB which is too small for large imports)
	r.Body = http.MaxBytesReader(w, r.Body, 50<<20)
	var req dto.FullImportRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respond.Error(w, http.StatusBadRequest, "INVALID_BODY", "invalid request body")
		return
	}
	if err := validate.Struct(req); err != nil {
		respond.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", err.Error())
		return
	}

	result, err := h.svc.Import(r.Context(), userID, req)
	if err != nil {
		slog.Error("full import failed", "error", err, "user_id", userID)
		respond.Error(w, http.StatusInternalServerError, "IMPORT_ERROR", "failed to import data")
		return
	}

	respond.JSON(w, http.StatusOK, result)
}
