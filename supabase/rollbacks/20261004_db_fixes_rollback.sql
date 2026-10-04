-- Rollback for supabase/migrations/20261004_db_fixes.sql
-- Restores the original policies exactly as they were (definitions captured from
-- pg_policies before the migration ran) and removes the trigger. The index and the
-- role_changes table are left in place: they're harmless, and role_changes holds history.
BEGIN;
DROP TRIGGER IF EXISTS registrations_enforce_capacity ON public.registrations;
DROP FUNCTION IF EXISTS public.enforce_event_capacity();
CREATE POLICY "Anyone can insert analytics" ON public.certificate_analytics AS PERMISSIVE FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Service role full access to certificate_positions" ON public.certificate_positions AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access to certificate_templates" ON public.certificate_templates AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access to certificates" ON public.certificates AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access to daily_checkins" ON public.daily_checkins AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Allow public insert event_attendance_scans" ON public.event_attendance_scans AS PERMISSIVE FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow read event_attendance_scans" ON public.event_attendance_scans AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Allow public update event_attendees" ON public.event_attendees AS PERMISSIVE FOR UPDATE TO public USING (true) WITH CHECK (true);
CREATE POLICY "Allow read event_attendees" ON public.event_attendees AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Service role full access to event_feedback_forms" ON public.event_feedback_forms AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access to feedback_questions" ON public.feedback_questions AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access to feedback_responses" ON public.feedback_responses AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Evaluators can manage own evaluations" ON public.form_evaluations AS PERMISSIVE FOR ALL TO public USING (true);
CREATE POLICY "Public can read form_evaluators by token" ON public.form_evaluators AS PERMISSIVE FOR SELECT TO public USING (true);
CREATE POLICY "Service role full access to xp_awards" ON public.xp_awards AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
COMMIT;
