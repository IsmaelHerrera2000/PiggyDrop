-- supabase/migrations/004_push_locale.sql
ALTER TABLE push_subscriptions
  ADD COLUMN IF NOT EXISTS locale TEXT NOT NULL DEFAULT 'es';

ALTER TABLE goals
  ADD COLUMN IF NOT EXISTS description  TEXT        DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS target_date  DATE        DEFAULT NULL;