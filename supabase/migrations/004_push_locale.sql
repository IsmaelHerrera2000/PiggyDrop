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

















