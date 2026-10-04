-- =====================================================
-- Migration: database fixes (4 Oct 2026)
--
-- Deletes NO rows and changes NO existing values. It:
--   1. S1: removes "allow everyone" policies that let the public browser key
--      read/write certificates, XP, check-ins, feedback, evaluator tokens and
--      attendee phone numbers. The app's server code uses the service-role key,
--      which bypasses RLS, so the site keeps working. Intentional public-read
--      policies (clubs, club_members, resources, posts, comments, projects,
--      profiles, hackathon schedule/settings) are untouched.
--   2. R1: a trigger that refuses a registration once an event is at capacity,
--      serialised per event so two students can't take the last seat together.
--      Same rule as the app: every registration row counts; NULL capacity = no limit.
--   3. P5: index for "all registrations of an event" (admin pages, capacity check).
--   4. role_changes: history for the new Admin Roles page.
--
-- Rollback: supabase/rollbacks/20261004_db_fixes_rollback.sql
-- =====================================================

-- Fail fast instead of queueing behind a long transaction.
SET lock_timeout = '5s';

-- 1. S1: open policies -----------------------------------------------------
DROP POLICY IF EXISTS "Service role full access to certificate_positions" ON public.certificate_positions;
DROP POLICY IF EXISTS "Service role full access to certificate_templates" ON public.certificate_templates;
DROP POLICY IF EXISTS "Service role full access to certificates"          ON public.certificates;
DROP POLICY IF EXISTS "Service role full access to daily_checkins"        ON public.daily_checkins;
DROP POLICY IF EXISTS "Service role full access to event_feedback_forms"  ON public.event_feedback_forms;
DROP POLICY IF EXISTS "Service role full access to feedback_questions"    ON public.feedback_questions;
DROP POLICY IF EXISTS "Service role full access to feedback_responses"    ON public.feedback_responses;
DROP POLICY IF EXISTS "Service role full access to xp_awards"             ON public.xp_awards;
DROP POLICY IF EXISTS "Evaluators can manage own evaluations"             ON public.form_evaluations;
DROP POLICY IF EXISTS "Public can read form_evaluators by token"          ON public.form_evaluators;
DROP POLICY IF EXISTS "Allow read event_attendees"                        ON public.event_attendees;
DROP POLICY IF EXISTS "Allow public update event_attendees"               ON public.event_attendees;
DROP POLICY IF EXISTS "Allow read event_attendance_scans"                 ON public.event_attendance_scans;
DROP POLICY IF EXISTS "Allow public insert event_attendance_scans"        ON public.event_attendance_scans;
DROP POLICY IF EXISTS "Anyone can insert analytics"                       ON public.certificate_analytics;

-- 2. R1: capacity --------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_event_capacity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    cap   integer;
    taken integer;
BEGIN
    -- Row lock on the event: concurrent registrations for the same event wait
    -- here one at a time, so the count below can't go stale.
    SELECT capacity INTO cap FROM public.events WHERE id = NEW.event_id FOR NO KEY UPDATE;
    IF cap IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT count(*) INTO taken FROM public.registrations WHERE event_id = NEW.event_id;
    IF taken >= cap THEN
        RAISE EXCEPTION 'EVENT_FULL' USING HINT = 'This event has reached its capacity';
    END IF;
    RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS registrations_enforce_capacity ON public.registrations;
CREATE TRIGGER registrations_enforce_capacity
    BEFORE INSERT ON public.registrations
    FOR EACH ROW EXECUTE FUNCTION public.enforce_event_capacity();

-- 3. P5: index -------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_registrations_event_id ON public.registrations(event_id);

-- 4. Role change history ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.role_changes (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          uuid NOT NULL,
    user_name        text,
    user_email       text,
    old_role         text,
    new_role         text NOT NULL,
    changed_by       uuid,
    changed_by_email text,
    changed_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_role_changes_changed_at ON public.role_changes(changed_at DESC);
-- RLS on with no policies: only the server (service role) can read or write it.
ALTER TABLE public.role_changes ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.role_changes TO service_role;
