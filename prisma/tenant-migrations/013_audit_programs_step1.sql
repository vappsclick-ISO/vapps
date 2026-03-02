-- Audit Management Step 1: Audit Program (strategic level)
-- One program per org; stores program owner (auditee), lead auditor, process, period, scope, type, criteria, risks, schedule, KPIs, reviews.

CREATE TABLE IF NOT EXISTS audit_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  start_period date NOT NULL,
  end_period date NOT NULL,
  system_creation_date date,
  program_purpose text,
  audit_scope text,
  audit_type text,
  audit_criteria text,
  process_id text NOT NULL REFERENCES processes(id) ON DELETE RESTRICT,
  program_owner_user_id uuid NOT NULL,
  lead_auditor_user_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid
);

CREATE INDEX IF NOT EXISTS idx_audit_programs_process ON audit_programs(process_id);
CREATE INDEX IF NOT EXISTS idx_audit_programs_lead_auditor ON audit_programs(lead_auditor_user_id);

CREATE TABLE IF NOT EXISTS audit_program_sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_program_id uuid NOT NULL REFERENCES audit_programs(id) ON DELETE CASCADE,
  site_id text NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  UNIQUE (audit_program_id, site_id)
);

CREATE TABLE IF NOT EXISTS audit_program_risks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_program_id uuid NOT NULL REFERENCES audit_programs(id) ON DELETE CASCADE,
  rop_number text NOT NULL,
  category text,
  description text,
  impact text,
  impact_class text,
  frequency text,
  priority text,
  priority_class text
);

CREATE TABLE IF NOT EXISTS audit_program_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_program_id uuid NOT NULL REFERENCES audit_programs(id) ON DELETE CASCADE,
  audit_number text NOT NULL,
  audit_type text,
  focus text,
  frequency text,
  target_months text,
  lead_auditor_name text
);

CREATE TABLE IF NOT EXISTS audit_program_kpis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_program_id uuid NOT NULL REFERENCES audit_programs(id) ON DELETE CASCADE,
  kpia_number text NOT NULL,
  description text,
  impact text,
  score text,
  priority text,
  comments text
);

CREATE TABLE IF NOT EXISTS audit_program_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_program_id uuid NOT NULL REFERENCES audit_programs(id) ON DELETE CASCADE,
  pri_number text NOT NULL,
  review_type text,
  comments text,
  priority text,
  priority_class text,
  action text
);
