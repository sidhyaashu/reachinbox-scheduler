-- Migration: 003_email_attachments.sql
-- Description: Add attachments column to emails table for supporting files and images

ALTER TABLE emails ADD COLUMN IF NOT EXISTS attachments JSONB;
