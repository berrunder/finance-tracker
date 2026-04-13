package handler

import (
	"fmt"
	"reflect"
	"strings"

	"github.com/go-playground/validator/v10"
)

// validationMessage converts a validator error into a user-safe message.
// It maps common validation tags to readable descriptions using JSON field
// names (via RegisterTagNameFunc), and falls back to "invalid request" for
// unrecognised error types.
func validationMessage(err error) string {
	ve, ok := err.(validator.ValidationErrors)
	if !ok {
		return "invalid request"
	}

	msgs := make([]string, 0, len(ve))
	for _, fe := range ve {
		msgs = append(msgs, fieldMessage(fe))
	}
	return strings.Join(msgs, "; ")
}

func fieldMessage(fe validator.FieldError) string {
	field := fe.Field()

	switch fe.Tag() {
	case "required":
		return fmt.Sprintf("%s is required", field)
	case "min":
		return fmt.Sprintf("%s must be at least %s %s", field, fe.Param(), sizeUnit(fe.Kind()))
	case "max":
		return fmt.Sprintf("%s must be at most %s %s", field, fe.Param(), sizeUnit(fe.Kind()))
	case "len":
		return fmt.Sprintf("%s must be exactly %s %s", field, fe.Param(), sizeUnit(fe.Kind()))
	case "oneof":
		return fmt.Sprintf("%s must be one of: %s", field, fe.Param())
	case "notcommon":
		return "password does not meet requirements"
	case "username":
		return "username must contain only lowercase letters, numbers, dots, hyphens, and underscores"
	default:
		return fmt.Sprintf("%s is invalid", field)
	}
}

func sizeUnit(k reflect.Kind) string {
	switch k {
	case reflect.Slice, reflect.Array, reflect.Map:
		return "item(s)"
	case reflect.String:
		return "characters"
	default:
		return "characters"
	}
}
