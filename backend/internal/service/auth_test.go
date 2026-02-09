package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/stretchr/testify/require"
	"golang.org/x/crypto/bcrypt"

	"github.com/sanches/finance-tracker-cc/backend/internal/dto"
	"github.com/sanches/finance-tracker-cc/backend/internal/store"
)

const testAuthSecret = "test-auth-secret-at-least-32-chars!"

type mockAuthStore struct {
	createUserFn             func(ctx context.Context, arg store.CreateUserParams) (store.User, error)
	getUserByUsernameFn      func(ctx context.Context, username string) (store.User, error)
	getUserByIDFn            func(ctx context.Context, id uuid.UUID) (store.User, error)
	createDefaultCategoriesFn func(ctx context.Context, userID uuid.UUID) error
}

func (m *mockAuthStore) CreateUser(ctx context.Context, arg store.CreateUserParams) (store.User, error) {
	return m.createUserFn(ctx, arg)
}
func (m *mockAuthStore) GetUserByUsername(ctx context.Context, username string) (store.User, error) {
	return m.getUserByUsernameFn(ctx, username)
}
func (m *mockAuthStore) GetUserByID(ctx context.Context, id uuid.UUID) (store.User, error) {
	return m.getUserByIDFn(ctx, id)
}
func (m *mockAuthStore) CreateDefaultCategories(ctx context.Context, userID uuid.UUID) error {
	return m.createDefaultCategoriesFn(ctx, userID)
}

func testUser(password string) store.User {
	hash, _ := bcrypt.GenerateFromPassword([]byte(password), bcrypt.MinCost)
	return store.User{
		ID:           uuid.New(),
		Username:     "testuser",
		PasswordHash: string(hash),
		DisplayName:  "Test User",
		BaseCurrency: "USD",
		CreatedAt:    makeTimestamp(),
		UpdatedAt:    makeTimestamp(),
	}
}

func TestLogin_Success(t *testing.T) {
	password := "correct-password"
	user := testUser(password)

	mock := &mockAuthStore{
		getUserByUsernameFn: func(ctx context.Context, username string) (store.User, error) {
			return user, nil
		},
	}

	svc := &Auth{queries: mock, secret: []byte(testAuthSecret)}
	resp, err := svc.Login(context.Background(), dto.LoginRequest{
		Username: "testuser",
		Password: password,
	})

	require.NoError(t, err)
	require.NotEmpty(t, resp.AccessToken)
	require.NotEmpty(t, resp.RefreshToken)
	require.Equal(t, user.Username, resp.User.Username)
	require.Equal(t, user.DisplayName, resp.User.DisplayName)
}

func TestLogin_WrongPassword(t *testing.T) {
	user := testUser("correct-password")

	mock := &mockAuthStore{
		getUserByUsernameFn: func(ctx context.Context, username string) (store.User, error) {
			return user, nil
		},
	}

	svc := &Auth{queries: mock, secret: []byte(testAuthSecret)}
	_, err := svc.Login(context.Background(), dto.LoginRequest{
		Username: "testuser",
		Password: "wrong-password",
	})

	require.ErrorIs(t, err, ErrInvalidCredentials)
}

func TestLogin_UserNotFound(t *testing.T) {
	mock := &mockAuthStore{
		getUserByUsernameFn: func(ctx context.Context, username string) (store.User, error) {
			return store.User{}, pgx.ErrNoRows
		},
	}

	svc := &Auth{queries: mock, secret: []byte(testAuthSecret)}
	_, err := svc.Login(context.Background(), dto.LoginRequest{
		Username: "nonexistent",
		Password: "any",
	})

	require.ErrorIs(t, err, ErrInvalidCredentials)
}

func TestRegister_DuplicateUser(t *testing.T) {
	mock := &mockAuthStore{
		createUserFn: func(ctx context.Context, arg store.CreateUserParams) (store.User, error) {
			return store.User{}, errors.New("duplicate key value violates unique constraint (23505)")
		},
	}

	svc := &Auth{queries: mock, secret: []byte(testAuthSecret)}
	_, err := svc.Register(context.Background(), dto.RegisterRequest{
		Username:     "existing",
		Password:     "password123",
		DisplayName:  "Test",
		BaseCurrency: "USD",
	})

	require.ErrorIs(t, err, ErrUserExists)
}

func TestRefresh_ValidToken(t *testing.T) {
	user := testUser("password")
	mock := &mockAuthStore{
		getUserByIDFn: func(ctx context.Context, id uuid.UUID) (store.User, error) {
			return user, nil
		},
	}

	svc := &Auth{queries: mock, secret: []byte(testAuthSecret)}

	// Generate a refresh token
	refreshToken, err := svc.generateToken(user.ID, "refresh", 7*24*time.Hour)
	require.NoError(t, err)

	resp, err := svc.Refresh(context.Background(), refreshToken)
	require.NoError(t, err)
	require.NotEmpty(t, resp.AccessToken)
	require.NotEmpty(t, resp.RefreshToken)
}

func TestRefresh_AccessToken(t *testing.T) {
	user := testUser("password")
	mock := &mockAuthStore{}

	svc := &Auth{queries: mock, secret: []byte(testAuthSecret)}

	// Generate an access token (not refresh)
	accessToken := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":  user.ID.String(),
		"type": "access",
		"iat":  float64(1000000),
		"exp":  float64(9999999999),
	})
	tokenStr, _ := accessToken.SignedString([]byte(testAuthSecret))

	_, err := svc.Refresh(context.Background(), tokenStr)
	require.ErrorIs(t, err, ErrInvalidToken)
}
