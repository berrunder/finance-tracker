package handler

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"reflect"
	"regexp"
	"strings"

	"github.com/go-playground/validator/v10"
	"golang.org/x/text/unicode/norm"

	"github.com/sanches/finance-tracker-cc/backend/internal/dto"
	"github.com/sanches/finance-tracker-cc/backend/internal/handler/respond"
	"github.com/sanches/finance-tracker-cc/backend/internal/service"
)

var usernameRe = regexp.MustCompile(`^[a-z0-9._-]{3,50}$`)

var validate = func() *validator.Validate {
	v := validator.New()
	v.RegisterTagNameFunc(func(f reflect.StructField) string {
		name := strings.SplitN(f.Tag.Get("json"), ",", 2)[0]
		if name == "-" || name == "" {
			return f.Name
		}
		return name
	})
	_ = v.RegisterValidation("notcommon", func(fl validator.FieldLevel) bool {
		return !isCommonPassword(fl.Field().String())
	})
	_ = v.RegisterValidation("username", func(fl validator.FieldLevel) bool {
		normalized := norm.NFKC.String(strings.ToLower(fl.Field().String()))
		return usernameRe.MatchString(normalized)
	})
	return v
}()

const (
	refreshCookieName   = "refresh_token"
	refreshCookiePath   = "/api/v1/auth"
	refreshCookieMaxAge = 7 * 24 * 60 * 60 // 7 days, matches the JWT exp
)

type authService interface {
	Register(ctx context.Context, req dto.RegisterRequest) (*service.AuthResult, error)
	Login(ctx context.Context, req dto.LoginRequest) (*service.AuthResult, error)
	Refresh(ctx context.Context, token string) (*service.AuthResult, error)
}

type Auth struct {
	svc          authService
	cookieSecure bool
}

func NewAuth(svc authService, cookieSecure bool) *Auth {
	return &Auth{svc: svc, cookieSecure: cookieSecure}
}

func (h *Auth) Register(w http.ResponseWriter, r *http.Request) {
	var req dto.RegisterRequest
	if err := decodeJSON(w, r, &req); err != nil {
		respond.Error(w, http.StatusBadRequest, "INVALID_BODY", "invalid request body")
		return
	}
	if err := validate.Struct(req); err != nil {
		respond.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", validationMessage(err))
		return
	}

	res, err := h.svc.Register(r.Context(), req)
	if err != nil {
		if errors.Is(err, service.ErrInvalidInviteCode) || errors.Is(err, service.ErrUserExists) {
			slog.Info("registration rejected", "reason", err.Error(), "username", req.Username)
			respond.Error(w, http.StatusForbidden, "REGISTRATION_REJECTED", "registration rejected")
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
		respond.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", validationMessage(err))
		return
	}

	res, err := h.svc.Login(r.Context(), req)
	if err != nil {
		h.clearRefreshCookie(w)
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
