package service

import (
	"context"
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/bcrypt"

	"github.com/sanches/finance-tracker-cc/backend/internal/dto"
	"github.com/sanches/finance-tracker-cc/backend/internal/store"
)

var (
	ErrUserExists       = errors.New("username already taken")
	ErrInvalidCredentials = errors.New("invalid username or password")
	ErrInvalidToken     = errors.New("invalid or expired token")
)

type authStore interface {
	CreateUser(ctx context.Context, arg store.CreateUserParams) (store.User, error)
	GetUserByUsername(ctx context.Context, username string) (store.User, error)
	GetUserByID(ctx context.Context, id uuid.UUID) (store.User, error)
	CreateDefaultCategories(ctx context.Context, userID uuid.UUID) error
}

type Auth struct {
	queries authStore
	secret  []byte
}

func NewAuth(queries *store.Queries, secret string) *Auth {
	return &Auth{queries: queries, secret: []byte(secret)}
}

func (s *Auth) Register(ctx context.Context, req dto.RegisterRequest) (*dto.AuthResponse, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	user, err := s.queries.CreateUser(ctx, store.CreateUserParams{
		Username:     req.Username,
		PasswordHash: string(hash),
		DisplayName:  req.DisplayName,
		BaseCurrency: req.BaseCurrency,
	})
	if err != nil {
		if isDuplicateKey(err) {
			return nil, ErrUserExists
		}
		return nil, err
	}

	// Seed default categories
	_ = s.queries.CreateDefaultCategories(ctx, user.ID)

	return s.generateAuthResponse(user)
}

func (s *Auth) Login(ctx context.Context, req dto.LoginRequest) (*dto.AuthResponse, error) {
	user, err := s.queries.GetUserByUsername(ctx, req.Username)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrInvalidCredentials
		}
		return nil, err
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		return nil, ErrInvalidCredentials
	}

	return s.generateAuthResponse(user)
}

func (s *Auth) Refresh(ctx context.Context, tokenStr string) (*dto.AuthResponse, error) {
	token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, jwt.ErrSignatureInvalid
		}
		return s.secret, nil
	})
	if err != nil || !token.Valid {
		return nil, ErrInvalidToken
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return nil, ErrInvalidToken
	}

	tokenType, _ := claims["type"].(string)
	if tokenType != "refresh" {
		return nil, ErrInvalidToken
	}

	sub, _ := claims["sub"].(string)
	userID, err := uuid.Parse(sub)
	if err != nil {
		return nil, ErrInvalidToken
	}

	user, err := s.queries.GetUserByID(ctx, userID)
	if err != nil {
		return nil, ErrInvalidToken
	}

	return s.generateAuthResponse(user)
}

func (s *Auth) generateAuthResponse(user store.User) (*dto.AuthResponse, error) {
	accessToken, err := s.generateToken(user.ID, "access", 15*time.Minute)
	if err != nil {
		return nil, err
	}

	refreshToken, err := s.generateToken(user.ID, "refresh", 7*24*time.Hour)
	if err != nil {
		return nil, err
	}

	return &dto.AuthResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		User: dto.UserResponse{
			ID:           user.ID,
			Username:     user.Username,
			DisplayName:  user.DisplayName,
			BaseCurrency: user.BaseCurrency,
			CreatedAt:    user.CreatedAt.Time,
		},
	}, nil
}

func (s *Auth) generateToken(userID uuid.UUID, tokenType string, expiry time.Duration) (string, error) {
	claims := jwt.MapClaims{
		"sub":  userID.String(),
		"type": tokenType,
		"iat":  time.Now().Unix(),
		"exp":  time.Now().Add(expiry).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(s.secret)
}

func isDuplicateKey(err error) bool {
	return err != nil && (errors.As(err, new(*pgDuplicateKeyError)) ||
		containsString(err.Error(), "duplicate key") ||
		containsString(err.Error(), "23505"))
}

type pgDuplicateKeyError struct{}

func (e *pgDuplicateKeyError) Error() string { return "duplicate key" }

func containsString(s, substr string) bool {
	return len(s) >= len(substr) && searchString(s, substr)
}

func searchString(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
