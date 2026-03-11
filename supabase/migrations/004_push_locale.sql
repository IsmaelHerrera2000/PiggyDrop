-- supabase/migrations/004_push_locale.sql
ALTER TABLE push_subscriptions
  ADD COLUMN IF NOT EXISTS locale TEXT NOT NULL DEFAULT 'es';

ALTER TABLE goals
  ADD COLUMN IF NOT EXISTS description  TEXT        DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS target_date  DATE        DEFAULT NULL;

  ALTER TABLE goals
  ADD COLUMN IF NOT EXISTS savings_period TEXT DEFAULT 'monthly' CHECK (savings_period IN ('monthly', 'weekly'));

-- Backfill: goals with monthly_target get 'monthly', rest NULL
UPDATE goals SET savings_period = 'monthly' WHERE monthly_target IS NOT NULL AND monthly_target > 0;
UPDATE goals SET savings_period = NULL WHERE monthly_target IS NULL OR monthly_target = 0;






















