-- =====================================================
-- Migration: Certificate Positions (Top 1 / Top 2 / ...)
-- - Positions hold ready-made certificates uploaded per student
-- - A student can hold one participation certificate OR position certificates per event
-- - Certificates can be 'pending' (prepared, not yet sent)
-- =====================================================

-- 1. Positions per event
CREATE TABLE IF NOT EXISTS public.certificate_positions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    title text NOT NULL,
    sort_order int NOT NULL DEFAULT 0,
    -- Default QR placement for every certificate in this position (percentages)
    qr_region jsonb NOT NULL DEFAULT '{"x": 84, "y": 7, "width": 11, "height": 11}',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_certificate_positions_event ON public.certificate_positions(event_id);

ALTER TABLE public.certificate_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to certificate_positions" ON public.certificate_positions
    FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON TABLE public.certificate_positions TO postgres;
GRANT ALL ON TABLE public.certificate_positions TO service_role;

-- 2. New certificate columns
ALTER TABLE public.certificates
ADD COLUMN IF NOT EXISTS position_id uuid REFERENCES public.certificate_positions(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS file_url text,          -- ready-made certificate (position certificates)
ADD COLUMN IF NOT EXISTS qr_region jsonb,        -- per-certificate QR override (falls back to position)
ADD COLUMN IF NOT EXISTS email_sent_at timestamptz;

COMMENT ON COLUMN public.certificates.position_id IS 'Set for position/award certificates; NULL for participation';
COMMENT ON COLUMN public.certificates.file_url IS 'Uploaded ready-made certificate image for position certificates';
COMMENT ON COLUMN public.certificates.qr_region IS 'Optional QR placement override for this certificate';

-- 3. Allow 'pending' status (prepared but not sent yet)
ALTER TABLE public.certificates DROP CONSTRAINT IF EXISTS certificates_status_check;
ALTER TABLE public.certificates
ADD CONSTRAINT certificates_status_check CHECK (status IN ('pending', 'valid', 'revoked'));

-- 4. Replace UNIQUE(event_id, user_id) with:
--    - one participation certificate per student per event
--    - one certificate per student per position
DO $$
DECLARE
    con record;
BEGIN
    FOR con IN
        SELECT c.conname
        FROM pg_constraint c
        WHERE c.conrelid = 'public.certificates'::regclass
          AND c.contype = 'u'
          AND (
              SELECT array_agg(a.attname::text ORDER BY a.attname)
              FROM unnest(c.conkey) k
              JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k
          ) = ARRAY['event_id', 'user_id']
    LOOP
        EXECUTE format('ALTER TABLE public.certificates DROP CONSTRAINT %I', con.conname);
    END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_certificates_participation
    ON public.certificates(event_id, user_id) WHERE position_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_certificates_position
    ON public.certificates(position_id, user_id) WHERE position_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_certificates_position ON public.certificates(position_id);
