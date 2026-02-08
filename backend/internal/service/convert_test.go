package service

import (
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/stretchr/testify/require"
)

func TestNumericFromString(t *testing.T) {
	t.Run("valid decimal", func(t *testing.T) {
		n := numericFromString("123.45")
		require.True(t, n.Valid)
		require.Equal(t, "123.45", numericToString(n))
	})

	t.Run("empty string", func(t *testing.T) {
		n := numericFromString("")
		require.False(t, n.Valid)
	})

	t.Run("garbage input", func(t *testing.T) {
		n := numericFromString("abc")
		require.False(t, n.Valid)
	})
}

func TestNumericToString(t *testing.T) {
	t.Run("valid numeric", func(t *testing.T) {
		n := numericFromString("123.45")
		require.Equal(t, "123.45", numericToString(n))
	})

	t.Run("invalid numeric", func(t *testing.T) {
		n := pgtype.Numeric{Valid: false}
		require.Equal(t, "0", numericToString(n))
	})

	t.Run("zero", func(t *testing.T) {
		n := numericFromString("0")
		require.Equal(t, "0.00", numericToString(n))
	})
}

func TestNumericAdd(t *testing.T) {
	t.Run("positive values", func(t *testing.T) {
		a := numericFromString("100.50")
		b := numericFromString("50.25")
		result := numericAdd(a, b)
		require.Equal(t, "150.75", numericToString(result))
	})

	t.Run("positive plus negative", func(t *testing.T) {
		a := numericFromString("100.00")
		b := numericFromString("-30.00")
		result := numericAdd(a, b)
		require.Equal(t, "70.00", numericToString(result))
	})
}

func TestNumericSub(t *testing.T) {
	t.Run("result positive", func(t *testing.T) {
		a := numericFromString("100.00")
		b := numericFromString("30.50")
		result := numericSub(a, b)
		require.Equal(t, "69.50", numericToString(result))
	})

	t.Run("result negative", func(t *testing.T) {
		a := numericFromString("30.00")
		b := numericFromString("100.00")
		result := numericSub(a, b)
		require.Equal(t, "-70.00", numericToString(result))
	})
}

func TestDateFromString(t *testing.T) {
	t.Run("valid date", func(t *testing.T) {
		d, err := dateFromString("2024-01-15")
		require.NoError(t, err)
		require.True(t, d.Valid)
		require.Equal(t, 2024, d.Time.Year())
		require.Equal(t, 1, int(d.Time.Month()))
		require.Equal(t, 15, d.Time.Day())
	})

	t.Run("invalid format", func(t *testing.T) {
		_, err := dateFromString("15/01/2024")
		require.Error(t, err)
	})
}

func TestDateToString(t *testing.T) {
	t.Run("valid date", func(t *testing.T) {
		d, _ := dateFromString("2024-01-15")
		require.Equal(t, "2024-01-15", dateToString(d))
	})

	t.Run("invalid date", func(t *testing.T) {
		d := pgtype.Date{Valid: false}
		require.Equal(t, "", dateToString(d))
	})
}

func TestUuidToNullable(t *testing.T) {
	t.Run("nil pointer", func(t *testing.T) {
		result := uuidToNullable(nil)
		require.False(t, result.Valid)
	})

	t.Run("non-nil pointer", func(t *testing.T) {
		id := uuid.New()
		result := uuidToNullable(&id)
		require.True(t, result.Valid)
		require.Equal(t, id, uuid.UUID(result.Bytes))
	})
}

func TestNullableToUUID(t *testing.T) {
	t.Run("valid", func(t *testing.T) {
		id := uuid.New()
		pgID := pgtype.UUID{Bytes: id, Valid: true}
		result := nullableToUUID(pgID)
		require.NotNil(t, result)
		require.Equal(t, id, *result)
	})

	t.Run("invalid", func(t *testing.T) {
		pgID := pgtype.UUID{Valid: false}
		result := nullableToUUID(pgID)
		require.Nil(t, result)
	})
}
