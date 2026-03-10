package config

import (
	"github.com/kelseyhightower/envconfig"
)

type Config struct {
	Port        string `envconfig:"PORT" default:"8080"`
	DatabaseURL string `envconfig:"DATABASE_URL" required:"true"`
	JWTSecret   string `envconfig:"JWT_SECRET" required:"true"`
	InviteCodes string `envconfig:"INVITE_CODES" required:"true"`

	// Exchange rate sync: "background" runs a daily goroutine, "endpoint" exposes only the HTTP trigger.
	ExchangeRateSyncMode  string `envconfig:"EXCHANGE_RATE_SYNC_MODE" default:"endpoint"`
	ExchangeRateSyncToken string `envconfig:"EXCHANGE_RATE_SYNC_TOKEN"`
}

func Load() (*Config, error) {
	var cfg Config
	if err := envconfig.Process("", &cfg); err != nil {
		return nil, err
	}
	return &cfg, nil
}
