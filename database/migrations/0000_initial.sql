-- PQFile Secure MVP: additive initialization only.
-- No DROP/ALTER/TRUNCATE statements. Keep synchronized with apps/api/src/db/schema.ts.
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email varchar(255) NOT NULL,
  display_name varchar(150) NOT NULL,
  password_hash text NOT NULL,
  role varchar(30) NOT NULL DEFAULT 'USER',
  status varchar(30) NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_email_unique UNIQUE (email)
);

CREATE TABLE IF NOT EXISTS user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_sessions_token_hash_unique UNIQUE (token_hash)
);

CREATE TABLE IF NOT EXISTS user_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose varchar(20) NOT NULL,
  algorithm varchar(30) NOT NULL,
  public_key text NOT NULL,
  fingerprint varchar(128) NOT NULL,
  status varchar(30) NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS key_backups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  encrypted_blob text NOT NULL,
  format_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES users(id),
  display_label varchar(160) NOT NULL,
  object_key text NOT NULL,
  source_type varchar(24) NOT NULL DEFAULT 'REAL',
  cipher_size integer NOT NULL,
  iv text NOT NULL,
  manifest jsonb NOT NULL,
  signature text NOT NULL,
  signer_public_key text NOT NULL,
  status varchar(30) NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT files_object_key_unique UNIQUE (object_key)
);

CREATE TABLE IF NOT EXISTS file_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id uuid NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id),
  recipient_key_id uuid NOT NULL REFERENCES user_keys(id),
  kem_ciphertext text NOT NULL,
  wrap_iv text NOT NULL,
  wrapped_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS recipient_file_unique ON file_recipients (file_id, user_id);

CREATE TABLE IF NOT EXISTS file_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id uuid NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  shared_by uuid NOT NULL REFERENCES users(id),
  shared_with uuid NOT NULL REFERENCES users(id),
  permission varchar(30) NOT NULL DEFAULT 'FILE_DOWNLOAD',
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS share_file_user_unique ON file_shares (file_id, shared_with);

CREATE TABLE IF NOT EXISTS activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES users(id),
  action varchar(80) NOT NULL,
  resource_type varchar(30) NOT NULL,
  resource_id uuid,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(120) NOT NULL,
  owner_id uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspace_members (
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role varchar(30) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workspace_members_pkey PRIMARY KEY (workspace_id, user_id)
);

-- Existing databases receive the non-destructive dataset provenance column.
ALTER TABLE files ADD COLUMN IF NOT EXISTS source_type varchar(24) NOT NULL DEFAULT 'REAL';
CREATE TABLE IF NOT EXISTS research_seed_runs (
  dataset_id varchar(80) PRIMARY KEY,
  completed_at timestamptz NOT NULL DEFAULT now(),
  file_count integer NOT NULL,
  share_count integer NOT NULL
);

-- Additive, idempotent event store; intentionally no plaintext document metadata.
CREATE TABLE IF NOT EXISTS security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type varchar(50) NOT NULL,
  risk_score integer NOT NULL DEFAULT 0,
  device_tag varchar(64),
  reason varchar(255) NOT NULL,
  acknowledged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS security_events_user_recent_idx ON security_events(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS security_events_user_unread_idx ON security_events(user_id,risk_score) WHERE acknowledged_at IS NULL;

-- User-declared task deadline is advisory: expiration is enforced separately.
ALTER TABLE file_shares ADD COLUMN IF NOT EXISTS task_deadline_at timestamptz;

-- PQC extension: additive and idempotent; encrypted payload only, no share fragments.
CREATE TABLE IF NOT EXISTS pqc_trusted_recipient_keys (
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key_id uuid NOT NULL REFERENCES user_keys(id),
  fingerprint varchar(64) NOT NULL,
  verified_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id,recipient_id)
);
CREATE TABLE IF NOT EXISTS pqc_recovery_plans (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  group_id uuid NOT NULL,
  encrypted_payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS pqc_key_history (
  sequence bigserial UNIQUE,
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key_id uuid NOT NULL REFERENCES user_keys(id),
  event_type varchar(40) NOT NULL,
  fingerprint varchar(64) NOT NULL,
  prev_hash varchar(64) NOT NULL,
  entry_hash varchar(64) NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pqc_key_history_user_idx ON pqc_key_history(user_id,created_at);

-- Hybrid envelope fields keep v1 ML-KEM-only envelopes compatible.
ALTER TABLE file_recipients ADD COLUMN IF NOT EXISTS hybrid_ephemeral_public text;
ALTER TABLE file_recipients ADD COLUMN IF NOT EXISTS hybrid_salt text;
ALTER TABLE pqc_trusted_recipient_keys ADD COLUMN IF NOT EXISTS x_key_id uuid REFERENCES user_keys(id);
ALTER TABLE pqc_trusted_recipient_keys ADD COLUMN IF NOT EXISTS x_fingerprint varchar(64);
