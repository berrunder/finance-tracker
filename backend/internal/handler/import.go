package handler

import (
	"net/http"

	"github.com/sanches/finance-tracker-cc/backend/internal/dto"
	"github.com/sanches/finance-tracker-cc/backend/internal/handler/respond"
	"github.com/sanches/finance-tracker-cc/backend/internal/middleware"
	"github.com/sanches/finance-tracker-cc/backend/internal/service"
)

type Import struct {
	svc *service.Import
}

func NewImport(svc *service.Import) *Import {
	return &Import{svc: svc}
}

func (h *Import) Upload(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(10 << 20); err != nil { // 10MB max
		respond.Error(w, http.StatusBadRequest, "FILE_TOO_LARGE", "file too large")
		return
	}

	file, _, err := r.FormFile("file")
	if err != nil {
		respond.Error(w, http.StatusBadRequest, "MISSING_FILE", "no file uploaded")
		return
	}
	defer file.Close()

	result, err := h.svc.ParseCSV(file)
	if err != nil {
		respond.Error(w, http.StatusBadRequest, "PARSE_ERROR", err.Error())
		return
	}

	respond.JSON(w, http.StatusOK, result)
}

func (h *Import) Confirm(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserID(r.Context())

	var req dto.CSVConfirmRequest
	if err := decodeJSON(w, r, &req); err != nil {
		respond.Error(w, http.StatusBadRequest, "INVALID_BODY", "invalid request body")
		return
	}
	if err := validate.Struct(req); err != nil {
		respond.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", err.Error())
		return
	}

	count, err := h.svc.ConfirmImport(r.Context(), userID, req)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "IMPORT_ERROR", "failed to import transactions")
		return
	}

	respond.JSON(w, http.StatusOK, map[string]any{"imported": count})
}
