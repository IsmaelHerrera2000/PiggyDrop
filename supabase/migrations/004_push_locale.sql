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


-- Recalcula saved_amount de todas las metas a partir de sus depósitos reales
-- Ejecutar en Supabase SQL Editor UNA SOLA VEZ

UPDATE goals
SET saved_amount = (
  SELECT COALESCE(SUM(amount), 0)
  FROM deposits
  WHERE deposits.goal_id = goals.id
);

-- Migration: add public_show_amounts to goals
ALTER TABLE goals
  ADD COLUMN IF NOT EXISTS public_show_amounts BOOLEAN DEFAULT false NOT NULL;

-- Migration 009: FCM tokens table
-- Ejecutar en Supabase SQL Editor

CREATE TABLE IF NOT EXISTS fcm_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token      TEXT NOT NULL UNIQUE,
  locale     TEXT NOT NULL DEFAULT 'es',
  platform   TEXT NOT NULL DEFAULT 'web', -- 'web' | 'android' | 'ios'
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast lookups by user
CREATE INDEX IF NOT EXISTS fcm_tokens_user_id_idx ON fcm_tokens(user_id);

-- RLS
ALTER TABLE fcm_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own FCM tokens" ON fcm_tokens
  FOR ALL USING (auth.uid() = user_id);

-- Service role can read all (for cron job)
CREATE POLICY "Service role reads all FCM tokens" ON fcm_tokens
  FOR SELECT USING (auth.role() = 'service_role');















