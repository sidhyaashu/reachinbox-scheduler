-- Migration 004: Enable Outbox Concurrency with Atomic Lock-and-Claim
-- Allows outbox_events to transition to 'PROCESSING' during atomic dispatch claiming to prevent duplicate fetches across concurrent scheduler instances

ALTER TABLE outbox_events DROP CONSTRAINT IF EXISTS valid_outbox_status;
ALTER TABLE outbox_events ADD CONSTRAINT valid_outbox_status CHECK (status IN ('PENDING', 'PROCESSING', 'DISPATCHED', 'FAILED'));

-- Index on status for high-speed concurrent outbox queries
CREATE INDEX IF NOT EXISTS idx_outbox_status_concurrency ON outbox_events(status, created_at) WHERE status IN ('PENDING', 'PROCESSING');
