package service

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/sanches/finance-tracker-cc/backend/internal/dto"
	"github.com/sanches/finance-tracker-cc/backend/internal/store"
)

type userStore interface {
	UpdateUser(ctx context.Context, arg store.UpdateUserParams) (store.User, error)
	GetUserByID(ctx context.Context, id uuid.UUID) (store.User, error)
}

type User struct {
	queries userStore
}

func NewUser(queries *store.Queries) *User {
	return &User{queries: queries}
}

func (s *User) Update(ctx context.Context, userID uuid.UUID, req dto.UpdateUserRequest) (*dto.UserResponse, error) {
	user, err := s.queries.UpdateUser(ctx, store.UpdateUserParams{
		ID:           userID,
		DisplayName:  req.DisplayName,
		BaseCurrency: req.BaseCurrency,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}

	return &dto.UserResponse{
		ID:           user.ID,
		Username:     user.Username,
		DisplayName:  user.DisplayName,
		BaseCurrency: user.BaseCurrency,
		CreatedAt:    user.CreatedAt.Time,
	}, nil
}
