-- Audit Plans (Step 2): one plan per "audit instance" linked to a program.
-- Program Responsible Person = Auditee (program_owner_user_id in audit_programs).
-- Lead Auditor creates plan in Step 2; submits to Auditee → status plan_submitted_to_auditee, redirect to main table.
-- Assigned auditors see plan in main table; open Step 3 (findings). Submit to Auditee → findings_submitted_to_auditee (auditor locked).

CREATE TABLE IF NOT EXISTS audit_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_program_id uuid NOT NULL REFERENCES audit_programs(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'draft',
  -- plan_submitted_to_auditee = Lead Auditor submitted plan; findings_submitted_to_auditee = Auditor submitted findings to Auditee
  lead_auditor_user_id uuid NOT NULL,
  auditee_user_id uuid NOT NULL,
  title text,
  audit_number text,
  criteria text,
  planned_date date,
  date_prepared date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  plan_submitted_at timestamptz,
  findings_submitted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_audit_plans_program ON audit_plans(audit_program_id);
CREATE INDEX IF NOT EXISTS idx_audit_plans_lead_auditor ON audit_plans(lead_auditor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_plans_auditee ON audit_plans(auditee_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_plans_status ON audit_plans(status);

CREATE TABLE IF NOT EXISTS audit_plan_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_plan_id uuid NOT NULL REFERENCES audit_plans(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role_assignment text,
  UNIQUE (audit_plan_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_audit_plan_assignments_plan ON audit_plan_assignments(audit_plan_id);
CREATE INDEX IF NOT EXISTS idx_audit_plan_assignments_user ON audit_plan_assignments(user_id);

CREATE TABLE IF NOT EXISTS audit_plan_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_plan_id uuid NOT NULL REFERENCES audit_plans(id) ON DELETE CASCADE,
  row_index int NOT NULL,
  standard text,
  clause text,
  subclauses text,
  requirement text,
  question text,
  evidence_example text,
  evidence_seen text,
  status text NOT NULL DEFAULT 'not_audited',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_plan_findings_plan ON audit_plan_findings(audit_plan_id);
