-- =====================================================
-- Migration: admin activity log (5 Oct 2026)
--
-- Adds ONE new table, admin_audit_log, for the /admin/logs page: who changed
-- what in the admin panel (and in Club Management), and when.
-- Touches no existing table, deletes nothing, changes no existing values.
--
-- Rows can only be added: a trigger refuses UPDATE and DELETE, so a log entry
-- can't be edited or removed from the app (only by a database owner in SQL).
--
-- Rollback: supabase/rollbacks/20261005_admin_audit_log_rollback.sql
-- =====================================================

SET lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    created_at    timestamptz NOT NULL DEFAULT now(),
    request_id    uuid,                 -- changes made by the same click share one id
    actor_id      text,
    actor_name    text,
    actor_email   text,
    actor_role    text,
    action        text NOT NULL,        -- insert | update | upsert | delete | upload | remove | email | …
    entity        text NOT NULL,        -- table or bucket, e.g. events, club_members, storage:events
    target_id     text,
    target_label  text,                 -- e.g. the event title, member name
    summary       text NOT NULL,        -- one readable line
    page          text,                 -- admin page the change was made from
    details       jsonb                 -- changed fields (values shortened), filters, row count
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON public.admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_actor      ON public.admin_audit_log (actor_email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_entity     ON public.admin_audit_log (entity, created_at DESC);

-- Append-only
CREATE OR REPLACE FUNCTION public.admin_audit_log_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'admin_audit_log is append-only';
END;
$$;
DROP TRIGGER IF EXISTS trg_admin_audit_log_append_only ON public.admin_audit_log;
CREATE TRIGGER trg_admin_audit_log_append_only
    BEFORE UPDATE OR DELETE ON public.admin_audit_log
    FOR EACH ROW EXECUTE FUNCTION public.admin_audit_log_append_only();

-- RLS on with no policies: only the server (service role) can read or write it.
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.admin_audit_log TO service_role;
