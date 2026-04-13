package handler

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"

	"github.com/sanches/finance-tracker-cc/backend/internal/dto"
	"github.com/sanches/finance-tracker-cc/backend/internal/service"
)

type stubAuthService struct {
	registerFn func(context.Context, dto.RegisterRequest) (*service.AuthResult, error)
	loginFn    func(context.Context, dto.LoginRequest) (*service.AuthResult, error)
	refreshFn  func(context.Context, string) (*service.AuthResult, error)
}

func (s *stubAuthService) Register(ctx context.Context, req dto.RegisterRequest) (*service.AuthResult, error) {
	if s.registerFn == nil {
		return nil, nil
	}
	return s.registerFn(ctx, req)
}

func (s *stubAuthService) Login(ctx context.Context, req dto.LoginRequest) (*service.AuthResult, error) {
	if s.loginFn == nil {
		return nil, nil
	}
	return s.loginFn(ctx, req)
}

func (s *stubAuthService) Refresh(ctx context.Context, token string) (*service.AuthResult, error) {
	if s.refreshFn == nil {
		return nil, nil
	}
	return s.refreshFn(ctx, token)
}

func testAuthResult() *service.AuthResult {
	return &service.AuthResult{
		AccessToken:  "access-token",
		RefreshToken: "refresh-token",
		User: dto.UserResponse{
			ID:           uuid.New(),
			Username:     "alice",
			DisplayName:  "Alice",
			BaseCurrency: "USD",
			CreatedAt:    time.Unix(0, 0).UTC(),
		},
	}
}

func findCookie(t *testing.T, rec *httptest.ResponseRecorder, name string) *http.Cookie {
	t.Helper()
	for _, cookie := range rec.Result().Cookies() {
		if cookie.Name == name {
			return cookie
		}
	}
	t.Fatalf("expected cookie %q to be set", name)
	return nil
}

func TestPasswordValidation_RejectsShort(t *testing.T) {
	req := dto.RegisterRequest{
		Username:     "alice",
		Password:     "short1",
		DisplayName:  "Alice",
		BaseCurrency: "USD",
		InviteCode:   "code",
	}
	if err := validate.Struct(req); err == nil {
		t.Fatal("expected validation error for short password, got nil")
	}
}

func TestPasswordValidation_RejectsCommon(t *testing.T) {
	cases := []string{
		"password123",
		"welcome1234",
		"qwerty12345",
		"iloveyou123",
	}
	for _, pw := range cases {
		req := dto.RegisterRequest{
			Username:     "alice",
			Password:     pw,
			DisplayName:  "Alice",
			BaseCurrency: "USD",
			InviteCode:   "code",
		}
		if err := validate.Struct(req); err == nil {
			t.Errorf("expected validation error for common password %q, got nil", pw)
		}
	}
}

func TestPasswordValidation_AcceptsStrong(t *testing.T) {
	req := dto.RegisterRequest{
		Username:     "alice",
		Password:     "Tr0ub4dor&3-horse-battery",
		DisplayName:  "Alice",
		BaseCurrency: "USD",
		InviteCode:   "code",
	}
	if err := validate.Struct(req); err != nil {
		t.Fatalf("expected strong password to pass validation, got %v", err)
	}
}

func TestChangePasswordValidation_RejectsCommonNewPassword(t *testing.T) {
	req := dto.ChangePasswordRequest{
		CurrentPassword: "whatever",
		NewPassword:     "password1234",
	}
	if err := validate.Struct(req); err == nil {
		t.Fatal("expected validation error for common new password, got nil")
	}
}

func TestChangePasswordValidation_AcceptsStrongNewPassword(t *testing.T) {
	req := dto.ChangePasswordRequest{
		CurrentPassword: "whatever",
		NewPassword:     "7mW!pq-XJ9aLz2",
	}
	if err := validate.Struct(req); err != nil {
		t.Fatalf("expected strong new password to pass validation, got %v", err)
	}
}

func TestChangePasswordValidation_RequiresCurrentPassword(t *testing.T) {
	req := dto.ChangePasswordRequest{
		NewPassword: "7mW!pq-XJ9aLz2",
	}
	if err := validate.Struct(req); err == nil {
		t.Fatal("expected validation error when current password is missing, got nil")
	}
}

func TestLogin_ClearsRefreshCookieOnFailure(t *testing.T) {
	h := NewAuth(&stubAuthService{
		loginFn: func(context.Context, dto.LoginRequest) (*service.AuthResult, error) {
			return nil, service.ErrInvalidCredentials
		},
	}, false)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", strings.NewReader(`{"username":"alice","password":"StrongPass123!"}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	h.Login(rec, req)

	require.Equal(t, http.StatusUnauthorized, rec.Code)
	cookie := findCookie(t, rec, refreshCookieName)
	require.Empty(t, cookie.Value)
	require.Equal(t, refreshCookiePath, cookie.Path)
	require.Equal(t, -1, cookie.MaxAge)
}

func TestRefresh_RotatesScopedCookieAndOmitsBodyRefreshToken(t *testing.T) {
	result := testAuthResult()
	h := NewAuth(&stubAuthService{
		refreshFn: func(_ context.Context, token string) (*service.AuthResult, error) {
			require.Equal(t, "old-refresh-token", token)
			return result, nil
		},
	}, true)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/refresh", nil)
	req.AddCookie(&http.Cookie{Name: refreshCookieName, Value: "old-refresh-token"})
	rec := httptest.NewRecorder()

	h.Refresh(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	cookie := findCookie(t, rec, refreshCookieName)
	require.Equal(t, result.RefreshToken, cookie.Value)
	require.Equal(t, refreshCookiePath, cookie.Path)
	require.True(t, cookie.HttpOnly)
	require.True(t, cookie.Secure)
	require.Equal(t, http.SameSiteStrictMode, cookie.SameSite)
	require.NotContains(t, rec.Body.String(), "refresh_token")
}

func TestRegister_RejectsInvalidInviteCodeWithGenericError(t *testing.T) {
	h := NewAuth(&stubAuthService{
		registerFn: func(context.Context, dto.RegisterRequest) (*service.AuthResult, error) {
			return nil, service.ErrInvalidInviteCode
		},
	}, false)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/register",
		strings.NewReader(`{"username":"alice","password":"Str0ng-Pass!phrase","display_name":"Alice","base_currency":"USD","invite_code":"bad"}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	h.Register(rec, req)

	require.Equal(t, http.StatusForbidden, rec.Code)
	require.Contains(t, rec.Body.String(), "REGISTRATION_REJECTED")
	require.NotContains(t, rec.Body.String(), "INVALID_INVITE_CODE")
}

func TestRegister_RejectsDuplicateUserWithGenericError(t *testing.T) {
	h := NewAuth(&stubAuthService{
		registerFn: func(context.Context, dto.RegisterRequest) (*service.AuthResult, error) {
			return nil, service.ErrUserExists
		},
	}, false)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/register",
		strings.NewReader(`{"username":"alice","password":"Str0ng-Pass!phrase","display_name":"Alice","base_currency":"USD","invite_code":"good"}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	h.Register(rec, req)

	require.Equal(t, http.StatusForbidden, rec.Code)
	require.Contains(t, rec.Body.String(), "REGISTRATION_REJECTED")
	require.NotContains(t, rec.Body.String(), "USER_EXISTS")
}

func TestUsernameValidation_AcceptsValid(t *testing.T) {
	cases := []string{"alice", "bob123", "a.b-c_d", "user.name-99"}
	for _, username := range cases {
		req := dto.RegisterRequest{
			Username:     username,
			Password:     "Str0ng-Pass!phrase",
			DisplayName:  "Test",
			BaseCurrency: "USD",
			InviteCode:   "code",
		}
		if err := validate.Struct(req); err != nil {
			t.Errorf("expected username %q to pass validation, got %v", username, err)
		}
	}
}

func TestUsernameValidation_RejectsInvalid(t *testing.T) {
	cases := []struct {
		name     string
		username string
	}{
		{"spaces", "alice bob"},
		{"special chars", "alice@home"},
		{"too short", "ab"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req := dto.RegisterRequest{
				Username:     tc.username,
				Password:     "Str0ng-Pass!phrase",
				DisplayName:  "Test",
				BaseCurrency: "USD",
				InviteCode:   "code",
			}
			if err := validate.Struct(req); err == nil {
				t.Errorf("expected validation error for username %q, got nil", tc.username)
			}
		})
	}
}

func TestUsernameValidation_NormalizesBeforeChecking(t *testing.T) {
	// Uppercase gets normalized to lowercase inside the validator, but
	// the validator should still reject it since the raw value doesn't match
	// the pattern (validator normalizes internally but the field value
	// is uppercase — the regex requires lowercase).
	req := dto.RegisterRequest{
		Username:     "ALICE",
		Password:     "Str0ng-Pass!phrase",
		DisplayName:  "Test",
		BaseCurrency: "USD",
		InviteCode:   "code",
	}
	// The username validator normalizes then checks, so "ALICE" -> "alice" -> passes regex.
	// This is expected: the validator accepts it because the *normalized* form is valid.
	// The service layer then normalizes before storing.
	err := validate.Struct(req)
	require.NoError(t, err, "ALICE should pass validation because it normalizes to 'alice'")
}

func TestLogout_ClearsScopedRefreshCookie(t *testing.T) {
	h := NewAuth(&stubAuthService{}, false)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/logout", nil)
	rec := httptest.NewRecorder()

	h.Logout(rec, req)

	require.Equal(t, http.StatusNoContent, rec.Code)
	cookie := findCookie(t, rec, refreshCookieName)
	require.Empty(t, cookie.Value)
	require.Equal(t, refreshCookiePath, cookie.Path)
	require.Equal(t, -1, cookie.MaxAge)
}
