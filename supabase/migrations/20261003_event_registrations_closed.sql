-- =====================================================
-- Migration: "Stop registrations" switch for events
-- Additive only: one new column, default false, so every existing event keeps
-- accepting registrations exactly as before. No existing data is modified.
-- (On Postgres 11+, adding a column with a constant default is metadata-only:
-- no table rewrite.)
-- =====================================================

ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS registrations_closed boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.events.registrations_closed IS
    'When true, new registrations are refused (admin "Stop registrations" button). Existing registrations are unaffected.';
