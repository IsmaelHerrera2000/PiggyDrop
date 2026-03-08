-- supabase/migrations/002_add_category.sql
ALTER TABLE goals
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'otro';
