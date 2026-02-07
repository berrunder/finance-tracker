package service

import (
	"math/big"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

func numericFromString(s string) pgtype.Numeric {
	if s == "" {
		return pgtype.Numeric{Valid: false}
	}
	var n pgtype.Numeric
	if err := n.Scan(s); err != nil {
		return pgtype.Numeric{Valid: false}
	}
	return n
}

func numericToString(n pgtype.Numeric) string {
	if !n.Valid {
		return "0"
	}
	f := numericToBigFloat(n)
	return f.Text('f', 2)
}

func numericToBigFloat(n pgtype.Numeric) *big.Float {
	if !n.Valid || n.Int == nil {
		return new(big.Float)
	}
	f := new(big.Float).SetInt(n.Int)
	if n.Exp < 0 {
		divisor := new(big.Float).SetInt(new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(-n.Exp)), nil))
		f.Quo(f, divisor)
	} else if n.Exp > 0 {
		multiplier := new(big.Float).SetInt(new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(n.Exp)), nil))
		f.Mul(f, multiplier)
	}
	return f
}

func numericAdd(a, b pgtype.Numeric) pgtype.Numeric {
	fa := numericToBigFloat(a)
	fb := numericToBigFloat(b)
	result := new(big.Float).Add(fa, fb)
	return bigFloatToNumeric(result)
}

func numericSub(a, b pgtype.Numeric) pgtype.Numeric {
	fa := numericToBigFloat(a)
	fb := numericToBigFloat(b)
	result := new(big.Float).Sub(fa, fb)
	return bigFloatToNumeric(result)
}

func bigFloatToNumeric(f *big.Float) pgtype.Numeric {
	var n pgtype.Numeric
	text := f.Text('f', 2)
	_ = n.Scan(text)
	return n
}

func dateFromString(s string) (pgtype.Date, error) {
	t, err := time.Parse("2006-01-02", s)
	if err != nil {
		return pgtype.Date{}, err
	}
	return pgtype.Date{Time: t, Valid: true}, nil
}

func dateToString(d pgtype.Date) string {
	if !d.Valid {
		return ""
	}
	return d.Time.Format("2006-01-02")
}

func uuidToNullable(id *uuid.UUID) pgtype.UUID {
	if id == nil {
		return pgtype.UUID{Valid: false}
	}
	return pgtype.UUID{Bytes: *id, Valid: true}
}

func nullableToUUID(id pgtype.UUID) *uuid.UUID {
	if !id.Valid {
		return nil
	}
	u := uuid.UUID(id.Bytes)
	return &u
}
