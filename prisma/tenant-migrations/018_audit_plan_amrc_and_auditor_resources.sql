-- Audit Methods & Risk Considerations: one row per AMRC entry per plan.
CREATE TABLE IF NOT EXISTS audit_plan_amrc_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_plan_id uuid NOT NULL REFERENCES audit_plans(id) ON DELETE CASCADE,
  row_index int NOT NULL DEFAULT 0,
  review_category text,
  comments text,
  priority text NOT NULL DEFAULT 'MEDIUM',
  action text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_plan_amrc_rows_plan ON audit_plan_amrc_rows(audit_plan_id);

COMMENT ON TABLE audit_plan_amrc_rows IS 'Step 2: Audit Methods & Risk Considerations rows (review category, comments, priority, action).';

-- Manual Entry (and auditor assignment rows): one row per resource; user_id nullable for manual-only rows.
CREATE TABLE IF NOT EXISTS audit_plan_auditor_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_plan_id uuid NOT NULL REFERENCES audit_plans(id) ON DELETE CASCADE,
  row_index int NOT NULL DEFAULT 0,
  user_id uuid,
  role_assignment text DEFAULT 'Auditor',
  technical_expert text,
  observer text,
  trainee text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_plan_auditor_resources_plan ON audit_plan_auditor_resources(audit_plan_id);

COMMENT ON TABLE audit_plan_auditor_resources IS 'Step 2: Auditor assignment rows with Manual Entry (technical expert, observer, trainee). user_id nullable for manual-only rows.';
