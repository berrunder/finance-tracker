package handler

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/sanches/finance-tracker-cc/backend/internal/dto"
	"github.com/sanches/finance-tracker-cc/backend/internal/handler/respond"
	"github.com/sanches/finance-tracker-cc/backend/internal/middleware"
	"github.com/sanches/finance-tracker-cc/backend/internal/service"
)

type User struct {
	svc *service.User
}

func NewUser(svc *service.User) *User {
	return &User{svc: svc}
}

func (h *User) Update(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserID(r.Context())

	var req dto.UpdateUserRequest
	if err := decodeJSON(w, r, &req); err != nil {
		respond.Error(w, http.StatusBadRequest, "INVALID_BODY", "invalid request body")
		return
	}
	if err := validate.Struct(req); err != nil {
		respond.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", err.Error())
		return
	}

	res, err := h.svc.Update(r.Context(), userID, req)
	if err != nil {
		if errors.Is(err, service.ErrNotFound) {
			respond.Error(w, http.StatusNotFound, "NOT_FOUND", "user not found")
			return
		}
		slog.Error("failed to update user", "error", err, "user_id", userID)
		respond.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to update user")
		return
	}

	respond.JSON(w, http.StatusOK, res)
}
