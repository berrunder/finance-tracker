package handler

import (
	"encoding/json"
	"net/http"

	"github.com/google/uuid"
)

const maxJSONBodySize = 1 << 20 // 1MB

func parseUUID(s string) (uuid.UUID, error) {
	return uuid.Parse(s)
}

func decodeJSON(w http.ResponseWriter, r *http.Request, dst any) error {
	r.Body = http.MaxBytesReader(w, r.Body, maxJSONBodySize)
	return json.NewDecoder(r.Body).Decode(dst)
}
