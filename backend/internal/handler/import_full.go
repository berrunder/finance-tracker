package handler

import (
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
	// Limit request body to 50 MB
	r.Body = http.MaxBytesReader(w, r.Body, 50<<20)

	userID := middleware.UserID(r.Context())

	var req dto.FullImportRequest
	if err := decodeJSON(w, r, &req); err != nil {
		respond.Error(w, http.StatusBadRequest, "INVALID_BODY", "invalid request body")
		return
	}
	if err := validate.Struct(req); err != nil {
		respond.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", err.Error())
		return
	}

	result, err := h.svc.Import(r.Context(), userID, req)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "IMPORT_ERROR", err.Error())
		return
	}

	respond.JSON(w, http.StatusOK, result)
}
