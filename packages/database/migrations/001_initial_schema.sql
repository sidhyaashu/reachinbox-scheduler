-- Migration: 001_initial_schema.sql
-- Description: Core schema for ReachInbox Scheduler

CREATE TABLE IF NOT EXISTS schema_migrations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_id VARCHAR(255) UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sessions
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Senders (Email inboxes with rate limits)
CREATE TABLE IF NOT EXISTS senders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL DEFAULT 'Default Sender',
  smtp_host VARCHAR(255) NOT NULL DEFAULT 'smtp.ethereal.email',
  smtp_port INT NOT NULL DEFAULT 587,
  smtp_user VARCHAR(255) NOT NULL DEFAULT '',
  smtp_pass VARCHAR(255) NOT NULL DEFAULT '',
  smtp_secure BOOLEAN NOT NULL DEFAULT FALSE,
  hourly_limit INT NOT NULL DEFAULT 200,
  min_delay_seconds INT NOT NULL DEFAULT 2,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Emails (Authoritative state)
CREATE TABLE IF NOT EXISTS emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES senders(id) ON DELETE CASCADE,
  recipient VARCHAR(255) NOT NULL,
  subject VARCHAR(500) NOT NULL,
  body TEXT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'SCHEDULED',
  scheduled_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  ethereal_message_url TEXT,
  idempotency_key VARCHAR(128) UNIQUE,
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_status CHECK (status IN ('SCHEDULED', 'QUEUED', 'PROCESSING', 'SENT', 'FAILED', 'DEFERRED', 'CANCELLED'))
);

-- Transactional Outbox Events
CREATE TABLE IF NOT EXISTS outbox_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_type VARCHAR(64) NOT NULL,
  aggregate_id UUID NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  retry_count INT NOT NULL DEFAULT 0,
  dispatched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_outbox_status CHECK (status IN ('PENDING', 'DISPATCHED', 'FAILED'))
);

-- Slack OAuth & Alert Integrations
CREATE TABLE IF NOT EXISTS slack_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  team_id VARCHAR(64) NOT NULL,
  team_name VARCHAR(255) NOT NULL,
  channel_id VARCHAR(64),
  channel_name VARCHAR(255),
  webhook_url TEXT,
  access_token TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Rate Limit Event Audit Log
CREATE TABLE IF NOT EXISTS rate_limit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES senders(id) ON DELETE CASCADE,
  window_start TIMESTAMPTZ NOT NULL,
  count INT NOT NULL,
  notified_slack BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_emails_user_status ON emails(user_id, status);
CREATE INDEX IF NOT EXISTS idx_emails_scheduled_at ON emails(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_emails_sender_status ON emails(sender_id, status);
CREATE INDEX IF NOT EXISTS idx_outbox_status_created ON outbox_events(status, created_at) WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_rate_limit_sender_window ON rate_limit_events(sender_id, window_start);
