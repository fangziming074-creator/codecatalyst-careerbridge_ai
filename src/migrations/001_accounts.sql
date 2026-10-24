CREATE TABLE IF NOT EXISTS account_users (
  id UUID PRIMARY KEY,
  username VARCHAR(24) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  recovery_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT account_users_username_format CHECK (username ~ '^[a-z0-9_]{3,24}$')
);

CREATE TABLE IF NOT EXISTS account_states (
  user_id UUID PRIMARY KEY REFERENCES account_users(id) ON DELETE CASCADE,
  state JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS account_sessions (
  token_hash CHAR(64) PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES account_users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS account_sessions_user_id_idx ON account_sessions(user_id);
CREATE INDEX IF NOT EXISTS account_sessions_expires_at_idx ON account_sessions(expires_at);
