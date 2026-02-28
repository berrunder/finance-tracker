package handler

import (
	"net/http"

	"github.com/sanches/finance-tracker-cc/backend/internal/handler/respond"
	"github.com/sanches/finance-tracker-cc/backend/internal/middleware"
	"github.com/sanches/finance-tracker-cc/backend/internal/service"
)

type Export struct {
	svc *service.Export
}

func NewExport(svc *service.Export) *Export {
	return &Export{svc: svc}
}

func (h *Export) CSV(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserID(r.Context())
	q := r.URL.Query()

	dateFrom := q.Get("date_from")
	dateTo := q.Get("date_to")
	if dateFrom == "" || dateTo == "" {
		respond.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "date_from and date_to are required")
		return
	}

	data, err := h.svc.ExportCSV(r.Context(), userID, dateFrom, dateTo)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "EXPORT_ERROR", "Failed to export transactions")
		return
	}

	w.Header().Set("Content-Type", "text/csv")
	w.Header().Set("Content-Disposition", `attachment; filename="export.csv"`)
	w.WriteHeader(http.StatusOK)
	w.Write(data)
}
