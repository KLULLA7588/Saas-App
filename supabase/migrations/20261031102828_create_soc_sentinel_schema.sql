/*
# SOC Sentinel — Security Events and Incidents Schema

1. New Tables
- `incidents` — confirmed security incidents with detection progression stage 1..6
- `security_events` — live stream of security events (normal + simulated), optionally linked to an incident

2. Security
- RLS enabled on both tables; CRUD granted to anon + authenticated (shared demo monitoring app, no per-user isolation).
- Realtime publication created if missing and includes both tables for live laptop/mobile updates.

3. Important notes
- Single-tenant, no-auth app; mobile login is a demo flow that does not gate data access, so anon access is required.
*/

CREATE SEQUENCE IF NOT EXISTS incident_seq START 1;

CREATE TABLE IF NOT EXISTS incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_code text NOT NULL DEFAULT ('INC-' || lpad((nextval('incident_seq')::text), 4, '0')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  severity text NOT NULL DEFAULT 'critical' CHECK (severity IN ('warning','critical')),
  threat_type text NOT NULL DEFAULT 'Suspicious Activity',
  status text NOT NULL DEFAULT 'investigating' CHECK (status IN ('investigating','contained','neutralized')),
  affected_user text NOT NULL DEFAULT 'unknown',
  affected_device text NOT NULL DEFAULT 'unknown',
  source_ip text NOT NULL DEFAULT '0.0.0.0',
  explanation text NOT NULL DEFAULT '',
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  stage smallint NOT NULL DEFAULT 1 CHECK (stage BETWEEN 1 AND 6)
);

CREATE TABLE IF NOT EXISTS security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ts timestamptz NOT NULL DEFAULT now(),
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warning','critical')),
  event_type text NOT NULL DEFAULT 'generic',
  source_ip text NOT NULL DEFAULT '0.0.0.0',
  username text,
  host text NOT NULL DEFAULT 'unknown',
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'processed' CHECK (status IN ('processed','suspicious','investigating','contained')),
  is_simulated boolean NOT NULL DEFAULT false,
  incident_id uuid REFERENCES incidents(id) ON DELETE SET NULL
);

ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON incidents TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON security_events TO anon, authenticated;
GRANT USAGE ON SEQUENCE incident_seq TO anon, authenticated;

DROP POLICY IF EXISTS "anon_select_incidents" ON incidents;
CREATE POLICY "anon_select_incidents" ON incidents FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_incidents" ON incidents;
CREATE POLICY "anon_insert_incidents" ON incidents FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_incidents" ON incidents;
CREATE POLICY "anon_update_incidents" ON incidents FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_incidents" ON incidents;
CREATE POLICY "anon_delete_incidents" ON incidents FOR DELETE
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_events" ON security_events;
CREATE POLICY "anon_select_events" ON security_events FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_events" ON security_events;
CREATE POLICY "anon_insert_events" ON security_events FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_events" ON security_events;
CREATE POLICY "anon_update_events" ON security_events FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_events" ON security_events;
CREATE POLICY "anon_delete_events" ON security_events FOR DELETE
  TO anon, authenticated USING (true);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabaserealtime') THEN
    CREATE PUBLICATION supabaserealtime WITH (publish = 'insert, update, delete');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabaserealtime' AND tablename = 'incidents'
  ) THEN
    ALTER PUBLICATION supabaserealtime ADD TABLE incidents;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabaserealtime' AND tablename = 'security_events'
  ) THEN
    ALTER PUBLICATION supabaserealtime ADD TABLE security_events;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_security_events_ts ON security_events (ts DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_incident_id ON security_events (incident_id);
CREATE INDEX IF NOT EXISTS idx_incidents_created_at ON incidents (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents (status);
