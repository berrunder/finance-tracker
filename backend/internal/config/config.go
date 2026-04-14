package config

import (
	"errors"
	"fmt"

	"github.com/kelseyhightower/envconfig"
)

const (
	minJWTSecretLength  = 32
	placeholderJWTValue = "change-this-to-a-random-secret-at-least-32-chars"
)

type Config struct {
	Port        string `envconfig:"PORT" default:"8080"`
	DatabaseURL string `envconfig:"DATABASE_URL" required:"true"`
	JWTSecret   string `envconfig:"JWT_SECRET" required:"true"`
	InviteCodes string `envconfig:"INVITE_CODES" required:"true"`

	// Exchange rate sync: "background" runs a daily goroutine, "endpoint" exposes only the HTTP trigger.
	ExchangeRateSyncMode  string `envconfig:"EXCHANGE_RATE_SYNC_MODE" default:"endpoint"`
	ExchangeRateSyncToken string `envconfig:"EXCHANGE_RATE_SYNC_TOKEN"`

	// CookieSecure controls the Secure flag on the refresh-token cookie. Defaults
	// to true; set COOKIE_SECURE=false for local http:// development.
	CookieSecure bool `envconfig:"COOKIE_SECURE" default:"true"`

	// BasePath is the URL prefix the app is served under (e.g. "/finance/").
	// Must match the frontend's VITE_BASE_PATH; the refresh cookie's Path is
	// derived from it so the browser sends it on every request to the app.
	BasePath string `envconfig:"BASE_PATH" default:"/"`
}

func Load() (*Config, error) {
	var cfg Config
	if err := envconfig.Process("", &cfg); err != nil {
		return nil, err
	}
	if err := cfg.validate(); err != nil {
		return nil, err
	}
	return &cfg, nil
}

func (c *Config) validate() error {
	if len(c.JWTSecret) < minJWTSecretLength {
		return fmt.Errorf("JWT_SECRET must be at least %d characters", minJWTSecretLength)
	}
	if c.JWTSecret == placeholderJWTValue {
		return errors.New("JWT_SECRET is set to the placeholder value from .env.example; generate a real secret")
	}
	return nil
}
