package handler

import (
	"net/http"
	"time"

	"github.com/sanches/finance-tracker-cc/backend/internal/handler/respond"
	"github.com/sanches/finance-tracker-cc/backend/internal/middleware"
	"github.com/sanches/finance-tracker-cc/backend/internal/service"
)

type Report struct {
	svc *service.Report
}

func NewReport(svc *service.Report) *Report {
	return &Report{svc: svc}
}

func (h *Report) Spending(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserID(r.Context())
	dateFrom, dateTo := getDateRange(r)

	result, err := h.svc.Spending(r.Context(), userID, dateFrom, dateTo)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}
	respond.JSON(w, http.StatusOK, map[string]any{"data": result})
}

func (h *Report) IncomeExpense(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserID(r.Context())
	dateFrom, dateTo := getDateRange(r)

	result, err := h.svc.IncomeExpense(r.Context(), userID, dateFrom, dateTo)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}
	respond.JSON(w, http.StatusOK, map[string]any{"data": result})
}

func (h *Report) BalanceHistory(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	accountID := q.Get("account_id")
	if accountID == "" {
		respond.Error(w, http.StatusBadRequest, "MISSING_PARAM", "account_id is required")
		return
	}

	dateFrom, dateTo := getDateRange(r)
	userID := middleware.UserID(r.Context())

	uid, err := parseUUID(accountID)
	if err != nil {
		respond.Error(w, http.StatusBadRequest, "INVALID_ID", "invalid account_id")
		return
	}

	result, err := h.svc.BalanceHistory(r.Context(), userID, uid, dateFrom, dateTo)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}
	respond.JSON(w, http.StatusOK, map[string]any{"data": result})
}

func (h *Report) Summary(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserID(r.Context())
	dateFrom, dateTo := getDateRange(r)

	result, err := h.svc.Summary(r.Context(), userID, dateFrom, dateTo)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error())
		return
	}
	respond.JSON(w, http.StatusOK, result)
}

func getDateRange(r *http.Request) (string, string) {
	q := r.URL.Query()
	dateFrom := q.Get("date_from")
	dateTo := q.Get("date_to")

	now := time.Now()
	if dateFrom == "" {
		dateFrom = time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC).Format("2006-01-02")
	}
	if dateTo == "" {
		dateTo = now.Format("2006-01-02")
	}
	return dateFrom, dateTo
}
