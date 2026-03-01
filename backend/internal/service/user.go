package service

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/sanches/finance-tracker-cc/backend/internal/dto"
	"github.com/sanches/finance-tracker-cc/backend/internal/store"
)

type userStore interface {
	UpdateUser(ctx context.Context, arg store.UpdateUserParams) (store.User, error)
	GetUserByID(ctx context.Context, id uuid.UUID) (store.User, error)
	DeleteAllUserTransactions(ctx context.Context, userID uuid.UUID) error
	DeleteAllUserAccounts(ctx context.Context, userID uuid.UUID) error
	DeleteAllUserSubcategories(ctx context.Context, userID uuid.UUID) error
	DeleteAllUserCategories(ctx context.Context, userID uuid.UUID) error
	CreateDefaultCategories(ctx context.Context, userID uuid.UUID) error
	WithTx(tx pgx.Tx) *store.Queries
}

type User struct {
	queries userStore
	pool    *pgxpool.Pool
}

func NewUser(queries *store.Queries, pool *pgxpool.Pool) *User {
	return &User{queries: queries, pool: pool}
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

func (s *User) Reset(ctx context.Context, userID uuid.UUID) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	q := s.queries.WithTx(tx)

	if err := q.DeleteAllUserTransactions(ctx, userID); err != nil {
		return err
	}
	if err := q.DeleteAllUserAccounts(ctx, userID); err != nil {
		return err
	}
	if err := q.DeleteAllUserSubcategories(ctx, userID); err != nil {
		return err
	}
	if err := q.DeleteAllUserCategories(ctx, userID); err != nil {
		return err
	}
	if err := q.CreateDefaultCategories(ctx, userID); err != nil {
		return err
	}

	return tx.Commit(ctx)
}
