package handler

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/sanches/finance-tracker-cc/backend/internal/dto"
	"github.com/sanches/finance-tracker-cc/backend/internal/service"
)

func TestValidationMessage(t *testing.T) {
	t.Run("formats validator errors with json field names", func(t *testing.T) {
		req := dto.RegisterRequest{
			Username:     "alice",
			Password:     "Str0ng-Pass!phrase",
			DisplayName:  "Alice",
			BaseCurrency: "US",
			InviteCode:   "invite-code",
		}

		err := validate.Struct(req)
		require.Error(t, err)
		require.Equal(t, "base_currency must be exactly 3 characters", validationMessage(err))
	})

	t.Run("falls back for non-validator errors", func(t *testing.T) {
		require.Equal(t, "invalid request", validationMessage(errors.New("boom")))
	})
}

func TestRegister_ReturnsSanitizedValidationError(t *testing.T) {
	h := NewAuth(&stubAuthService{
		registerFn: func(_ context.Context, _ dto.RegisterRequest) (*service.AuthResult, error) {
			t.Fatal("register service should not be called when request validation fails")
			return nil, nil
		},
	}, false, "/")

	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/register",
		strings.NewReader(`{"username":"alice","password":"short1","display_name":"Alice","base_currency":"USD","invite_code":"good"}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	h.Register(rec, req)

	require.Equal(t, http.StatusBadRequest, rec.Code)

	body := rec.Body.String()
	var resp dto.ErrorResponse
	require.NoError(t, json.Unmarshal([]byte(body), &resp))
	require.Equal(t, "VALIDATION_ERROR", resp.Error.Code)
	require.Equal(t, "password must be at least 10 characters", resp.Error.Message)
	require.NotContains(t, body, "RegisterRequest")
	require.NotContains(t, body, "failed on the")
	require.NotContains(t, body, "Key:")
}
