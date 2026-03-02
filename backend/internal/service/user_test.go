package service_test

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/sanches/finance-tracker-cc/backend/internal/dto"
	"github.com/sanches/finance-tracker-cc/backend/internal/service"
	"github.com/sanches/finance-tracker-cc/backend/internal/store"
	"golang.org/x/crypto/bcrypt"
)

type mockUserStore struct {
	user           store.User
	getUserErr     error
	updatePwErr    error
	updatePwCalled bool
}

func (m *mockUserStore) GetUserByID(_ context.Context, _ uuid.UUID) (store.User, error) {
	return m.user, m.getUserErr
}

func (m *mockUserStore) UpdateUserPassword(_ context.Context, arg store.UpdateUserPasswordParams) error {
	m.updatePwCalled = true
	return m.updatePwErr
}

func (m *mockUserStore) UpdateUser(_ context.Context, _ store.UpdateUserParams) (store.User, error) {
	return store.User{}, nil
}
func (m *mockUserStore) DeleteAllUserTransactions(_ context.Context, _ uuid.UUID) error { return nil }
func (m *mockUserStore) DeleteAllUserAccounts(_ context.Context, _ uuid.UUID) error     { return nil }
func (m *mockUserStore) DeleteAllUserCategories(_ context.Context, _ uuid.UUID) error   { return nil }
func (m *mockUserStore) CreateDefaultCategories(_ context.Context, _ uuid.UUID) error   { return nil }
func (m *mockUserStore) WithTx(_ pgx.Tx) *store.Queries                                 { return nil }

func makeHashedUser(t *testing.T, plainPassword string) store.User {
	t.Helper()
	hash, err := bcrypt.GenerateFromPassword([]byte(plainPassword), bcrypt.MinCost)
	if err != nil {
		t.Fatal(err)
	}
	return store.User{ID: uuid.New(), PasswordHash: string(hash)}
}

func TestChangePassword_Success(t *testing.T) {
	user := makeHashedUser(t, "oldpassword")
	mock := &mockUserStore{user: user}
	svc := service.NewUserWithStore(mock)

	err := svc.ChangePassword(context.Background(), user.ID, dto.ChangePasswordRequest{
		CurrentPassword: "oldpassword",
		NewPassword:     "newpassword123",
	})

	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if !mock.updatePwCalled {
		t.Fatal("expected UpdateUserPassword to be called")
	}
}

func TestChangePassword_WrongCurrentPassword(t *testing.T) {
	user := makeHashedUser(t, "oldpassword")
	mock := &mockUserStore{user: user}
	svc := service.NewUserWithStore(mock)

	err := svc.ChangePassword(context.Background(), user.ID, dto.ChangePasswordRequest{
		CurrentPassword: "wrongpassword",
		NewPassword:     "newpassword123",
	})

	if !errors.Is(err, service.ErrInvalidCredentials) {
		t.Fatalf("expected ErrInvalidCredentials, got %v", err)
	}
	if mock.updatePwCalled {
		t.Fatal("UpdateUserPassword should not have been called")
	}
}
