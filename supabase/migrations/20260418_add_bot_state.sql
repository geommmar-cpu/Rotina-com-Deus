-- Migration: Add bot_state columns directly to whatsapp_users
-- This eliminates the need to join user_progress for state management.

ALTER TABLE public.whatsapp_users
  ADD COLUMN IF NOT EXISTS bot_state        TEXT    DEFAULT 'menu',
  ADD COLUMN IF NOT EXISTS bot_step         INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bot_started_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bible_day        INTEGER DEFAULT 0;

-- Migrate existing progress data (latest state per user)
UPDATE public.whatsapp_users wu
SET
  bot_state      = COALESCE(up.last_prayer_type, 'menu'),
  bot_step       = COALESCE(up.last_prayer_step, 0),
  bible_day      = COALESCE(up.bible_365_day, 0)
FROM (
  SELECT DISTINCT ON (whatsapp_user_id)
    whatsapp_user_id,
    last_prayer_type,
    last_prayer_step,
    bible_365_day
  FROM public.user_progress
  ORDER BY whatsapp_user_id, updated_at DESC
) up
WHERE wu.id = up.whatsapp_user_id;
