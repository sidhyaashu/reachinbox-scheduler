-- Migration: 002_google_oauth_email.sql
-- Description: Add Google OAuth2 credentials to senders table for direct Gmail sending without passwords

ALTER TABLE senders ADD COLUMN IF NOT EXISTS auth_type VARCHAR(32) NOT NULL DEFAULT 'smtp';
ALTER TABLE senders ADD COLUMN IF NOT EXISTS google_refresh_token TEXT;
ALTER TABLE senders ADD COLUMN IF NOT EXISTS google_access_token TEXT;
