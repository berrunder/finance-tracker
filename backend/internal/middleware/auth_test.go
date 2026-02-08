package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

const testSecret = "test-secret-key-at-least-32-chars!"

func generateTestToken(userID uuid.UUID, tokenType string, expiry time.Duration, secret string) string {
	claims := jwt.MapClaims{
		"sub":  userID.String(),
		"type": tokenType,
		"iat":  time.Now().Unix(),
		"exp":  time.Now().Add(expiry).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, _ := token.SignedString([]byte(secret))
	return signed
}

func TestAuthenticate_ValidToken(t *testing.T) {
	auth := NewAuth(testSecret)
	userID := uuid.New()
	token := generateTestToken(userID, "access", 15*time.Minute, testSecret)

	var capturedID uuid.UUID
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedID = UserID(r.Context())
		w.WriteHeader(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()

	auth.Authenticate(next).ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	require.Equal(t, userID, capturedID)
}

func TestAuthenticate_MissingHeader(t *testing.T) {
	auth := NewAuth(testSecret)

	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Fatal("handler should not be called")
	})

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()

	auth.Authenticate(next).ServeHTTP(rec, req)

	require.Equal(t, http.StatusUnauthorized, rec.Code)
}

func TestAuthenticate_InvalidFormat(t *testing.T) {
	auth := NewAuth(testSecret)

	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Fatal("handler should not be called")
	})

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Basic xxx")
	rec := httptest.NewRecorder()

	auth.Authenticate(next).ServeHTTP(rec, req)

	require.Equal(t, http.StatusUnauthorized, rec.Code)
}

func TestAuthenticate_ExpiredToken(t *testing.T) {
	auth := NewAuth(testSecret)
	userID := uuid.New()
	token := generateTestToken(userID, "access", -1*time.Hour, testSecret)

	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Fatal("handler should not be called")
	})

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()

	auth.Authenticate(next).ServeHTTP(rec, req)

	require.Equal(t, http.StatusUnauthorized, rec.Code)
}

func TestAuthenticate_RefreshToken(t *testing.T) {
	auth := NewAuth(testSecret)
	userID := uuid.New()
	token := generateTestToken(userID, "refresh", 15*time.Minute, testSecret)

	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Fatal("handler should not be called")
	})

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()

	auth.Authenticate(next).ServeHTTP(rec, req)

	require.Equal(t, http.StatusUnauthorized, rec.Code)
}

func TestAuthenticate_InvalidSignature(t *testing.T) {
	auth := NewAuth(testSecret)
	userID := uuid.New()
	token := generateTestToken(userID, "access", 15*time.Minute, "wrong-secret-key-at-least-32-chars!")

	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Fatal("handler should not be called")
	})

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()

	auth.Authenticate(next).ServeHTTP(rec, req)

	require.Equal(t, http.StatusUnauthorized, rec.Code)
}

func TestUserID_Missing(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	id := UserID(req.Context())
	require.Equal(t, uuid.UUID{}, id)
}
