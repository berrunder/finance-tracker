package service

import (
	"context"
	"errors"
	"slices"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"golang.org/x/crypto/bcrypt"

	"github.com/sanches/finance-tracker-cc/backend/internal/dto"
	"github.com/sanches/finance-tracker-cc/backend/internal/store"
)

var (
	ErrUserExists         = errors.New("username already taken")
	ErrInvalidCredentials = errors.New("invalid username or password")
	ErrInvalidToken       = errors.New("invalid or expired token")
	ErrInvalidInviteCode  = errors.New("invalid invite code")

	// dummyHash is a pre-computed bcrypt hash used when the requested user does
	// not exist.  Running CompareHashAndPassword against it ensures the login
	// path takes roughly the same time regardless of whether the username is
	// valid, preventing timing-based user enumeration.
	dummyHash, _ = bcrypt.GenerateFromPassword([]byte("dummy-timing-padding"), bcrypt.DefaultCost)
)

type authStore interface {
	CreateUser(ctx context.Context, arg store.CreateUserParams) (store.User, error)
	GetUserByUsername(ctx context.Context, username string) (store.User, error)
	GetUserByID(ctx context.Context, id uuid.UUID) (store.User, error)
	CreateDefaultCategories(ctx context.Context, userID uuid.UUID) error
}

type Auth struct {
	queries     authStore
	secret      []byte
	inviteCodes []string
}

// AuthResult carries the output of a successful auth operation. The refresh
// token is kept separate from the DTO so handlers can place it in an
// HttpOnly cookie rather than the response body.
type AuthResult struct {
	AccessToken  string
	RefreshToken string
	User         dto.UserResponse
}

func NewAuth(queries *store.Queries, secret string, inviteCodes []string) *Auth {
	return &Auth{queries: queries, secret: []byte(secret), inviteCodes: inviteCodes}
}

func (s *Auth) Register(ctx context.Context, req dto.RegisterRequest) (*AuthResult, error) {
	validInvite := slices.Contains(s.inviteCodes, req.InviteCode)

	// Always run bcrypt so the response time doesn't reveal whether the
	// invite code was valid.
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	if !validInvite {
		return nil, ErrInvalidInviteCode
	}

	user, err := s.queries.CreateUser(ctx, store.CreateUserParams{
		Username:     req.Username,
		PasswordHash: string(hash),
		DisplayName:  req.DisplayName,
		BaseCurrency: req.BaseCurrency,
		InviteCode:   pgtype.Text{String: req.InviteCode, Valid: true},
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

func (s *Auth) Login(ctx context.Context, req dto.LoginRequest) (*AuthResult, error) {
	user, err := s.queries.GetUserByUsername(ctx, req.Username)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			// Run a dummy compare so the response time doesn't reveal
			// whether the username exists.
			bcrypt.CompareHashAndPassword(dummyHash, []byte(req.Password)) //nolint:errcheck
			return nil, ErrInvalidCredentials
		}
		return nil, err
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		return nil, ErrInvalidCredentials
	}

	return s.generateAuthResponse(user)
}

func (s *Auth) Refresh(ctx context.Context, tokenStr string) (*AuthResult, error) {
	token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (any, error) {
		return s.secret, nil
	}, jwt.WithValidMethods([]string{"HS256"}))
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

func (s *Auth) generateAuthResponse(user store.User) (*AuthResult, error) {
	accessToken, err := s.generateToken(user.ID, "access", 15*time.Minute)
	if err != nil {
		return nil, err
	}

	refreshToken, err := s.generateToken(user.ID, "refresh", 7*24*time.Hour)
	if err != nil {
		return nil, err
	}

	return &AuthResult{
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

