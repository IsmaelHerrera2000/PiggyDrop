-- supabase/migrations/004_push_locale.sql
ALTER TABLE push_subscriptions
  ADD COLUMN IF NOT EXISTS locale TEXT NOT NULL DEFAULT 'es';
