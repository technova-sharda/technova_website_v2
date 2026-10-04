-- Rollback for 20261005_admin_audit_log.sql
-- WARNING: this removes the activity log and every entry in it. Export it first
-- (Table editor → admin_audit_log → Export to CSV) if you may need it.
DROP TRIGGER IF EXISTS trg_admin_audit_log_append_only ON public.admin_audit_log;
DROP FUNCTION IF EXISTS public.admin_audit_log_append_only();
DROP TABLE IF EXISTS public.admin_audit_log;
