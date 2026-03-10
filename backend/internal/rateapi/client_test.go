package rateapi

import (
	"testing"

	"github.com/stretchr/testify/require"
)

const rubResponse = `{
  "date": "2026-03-09",
  "rub": {
    "amd": 4.70255397,
    "aud": 0.017973824,
    "eur": 0.01089454,
    "gel": 0.034289456,
    "rub": 1,
    "try": 0.55389445,
    "usd": 0.012558455
  }
}`

func TestParseResponse(t *testing.T) {
	t.Run("parses date", func(t *testing.T) {
		resp, err := parseResponse([]byte(rubResponse), "rub")
		require.NoError(t, err)
		require.Equal(t, "2026-03-09", resp.Date)
	})

	t.Run("parses all rates as decimal strings", func(t *testing.T) {
		resp, err := parseResponse([]byte(rubResponse), "rub")
		require.NoError(t, err)
		require.Len(t, resp.Rates, 7)
		require.Equal(t, "4.70255397", resp.Rates["amd"])
		require.Equal(t, "0.017973824", resp.Rates["aud"])
		require.Equal(t, "0.01089454", resp.Rates["eur"])
		require.Equal(t, "0.034289456", resp.Rates["gel"])
		require.Equal(t, "1", resp.Rates["rub"])
		require.Equal(t, "0.55389445", resp.Rates["try"])
		require.Equal(t, "0.012558455", resp.Rates["usd"])
	})

	t.Run("wrong base currency returns error", func(t *testing.T) {
		_, err := parseResponse([]byte(rubResponse), "usd")
		require.Error(t, err)
		require.Contains(t, err.Error(), "no rates found")
	})

	t.Run("invalid json returns error", func(t *testing.T) {
		_, err := parseResponse([]byte(`{not json}`), "rub")
		require.Error(t, err)
	})

	t.Run("missing date field still works", func(t *testing.T) {
		body := `{"rub": {"usd": 0.012}}`
		resp, err := parseResponse([]byte(body), "rub")
		require.NoError(t, err)
		require.Equal(t, "", resp.Date)
		require.Equal(t, "0.012", resp.Rates["usd"])
	})

	t.Run("preserves precision without float64 loss", func(t *testing.T) {
		// 0.1 + 0.2 = 0.30000000000000004 in float64, but we want exact strings
		body := `{"date":"2026-01-01","x":{"a":0.30000000000000004}}`
		resp, err := parseResponse([]byte(body), "x")
		require.NoError(t, err)
		require.Equal(t, "0.30000000000000004", resp.Rates["a"])
	})

	t.Run("integer rate preserved", func(t *testing.T) {
		body := `{"date":"2026-01-01","x":{"a":1}}`
		resp, err := parseResponse([]byte(body), "x")
		require.NoError(t, err)
		require.Equal(t, "1", resp.Rates["a"])
	})
}
