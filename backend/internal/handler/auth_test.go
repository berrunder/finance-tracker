package handler

import (
	"testing"

	"github.com/sanches/finance-tracker-cc/backend/internal/dto"
)

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
