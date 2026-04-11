package handler

import (
	"errors"
	"net/http"

	"github.com/go-playground/validator/v10"

	"github.com/sanches/finance-tracker-cc/backend/internal/dto"
	"github.com/sanches/finance-tracker-cc/backend/internal/handler/respond"
	"github.com/sanches/finance-tracker-cc/backend/internal/service"
)

var validate = func() *validator.Validate {
	v := validator.New()
	_ = v.RegisterValidation("notcommon", func(fl validator.FieldLevel) bool {
		return !isCommonPassword(fl.Field().String())
	})
	return v
}()

const (
	refreshCookieName   = "refresh_token"
	refreshCookiePath   = "/"
	refreshCookieMaxAge = 7 * 24 * 60 * 60 // 7 days, matches the JWT exp
)

type Auth struct {
	svc          *service.Auth
	cookieSecure bool
}

func NewAuth(svc *service.Auth, cookieSecure bool) *Auth {
	return &Auth{svc: svc, cookieSecure: cookieSecure}
}

func (h *Auth) Register(w http.ResponseWriter, r *http.Request) {
	var req dto.RegisterRequest
	if err := decodeJSON(w, r, &req); err != nil {
		respond.Error(w, http.StatusBadRequest, "INVALID_BODY", "invalid request body")
		return
	}
	if err := validate.Struct(req); err != nil {
		respond.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", err.Error())
		return
	}

	res, err := h.svc.Register(r.Context(), req)
	if err != nil {
		if errors.Is(err, service.ErrInvalidInviteCode) {
			respond.Error(w, http.StatusForbidden, "INVALID_INVITE_CODE", err.Error())
			return
		}
		if errors.Is(err, service.ErrUserExists) {
			respond.Error(w, http.StatusConflict, "USER_EXISTS", err.Error())
			return
		}
		respond.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to register")
		return
	}

	h.setRefreshCookie(w, res.RefreshToken)
	respond.JSON(w, http.StatusCreated, authResponse(res))
}

func (h *Auth) Login(w http.ResponseWriter, r *http.Request) {
	var req dto.LoginRequest
	if err := decodeJSON(w, r, &req); err != nil {
		respond.Error(w, http.StatusBadRequest, "INVALID_BODY", "invalid request body")
		return
	}
	if err := validate.Struct(req); err != nil {
		respond.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", err.Error())
		return
	}

	res, err := h.svc.Login(r.Context(), req)
	if err != nil {
		if errors.Is(err, service.ErrInvalidCredentials) {
			respond.Error(w, http.StatusUnauthorized, "INVALID_CREDENTIALS", err.Error())
			return
		}
		respond.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to login")
		return
	}

	h.setRefreshCookie(w, res.RefreshToken)
	respond.JSON(w, http.StatusOK, authResponse(res))
}

func (h *Auth) Refresh(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie(refreshCookieName)
	if err != nil || cookie.Value == "" {
		respond.Error(w, http.StatusUnauthorized, "INVALID_TOKEN", "missing refresh token")
		return
	}

	res, err := h.svc.Refresh(r.Context(), cookie.Value)
	if err != nil {
		if errors.Is(err, service.ErrInvalidToken) {
			h.clearRefreshCookie(w)
			respond.Error(w, http.StatusUnauthorized, "INVALID_TOKEN", err.Error())
			return
		}
		respond.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to refresh token")
		return
	}

	h.setRefreshCookie(w, res.RefreshToken)
	respond.JSON(w, http.StatusOK, authResponse(res))
}

func (h *Auth) Logout(w http.ResponseWriter, r *http.Request) {
	h.clearRefreshCookie(w)
	respond.NoContent(w)
}

func (h *Auth) setRefreshCookie(w http.ResponseWriter, token string) {
	http.SetCookie(w, &http.Cookie{
		Name:     refreshCookieName,
		Value:    token,
		Path:     refreshCookiePath,
		MaxAge:   refreshCookieMaxAge,
		HttpOnly: true,
		Secure:   h.cookieSecure,
		SameSite: http.SameSiteStrictMode,
	})
}

func (h *Auth) clearRefreshCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     refreshCookieName,
		Value:    "",
		Path:     refreshCookiePath,
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   h.cookieSecure,
		SameSite: http.SameSiteStrictMode,
	})
}

func authResponse(res *service.AuthResult) dto.AuthResponse {
	return dto.AuthResponse{
		AccessToken: res.AccessToken,
		User:        res.User,
	}
}
