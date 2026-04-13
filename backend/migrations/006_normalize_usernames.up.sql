-- Fail fast if lowercasing would create duplicate usernames.
DO $$
BEGIN
  IF EXISTS (
    SELECT LOWER(username), COUNT(*)
    FROM users
    GROUP BY LOWER(username)
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot migrate: duplicate usernames after lowercasing. Resolve manually before retrying.';
  END IF;
END $$;

UPDATE users SET username = LOWER(username) WHERE username != LOWER(username);
ALTER TABLE users ADD CONSTRAINT users_username_format CHECK (username ~ '^[a-z0-9._-]{3,50}$');
