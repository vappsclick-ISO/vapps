-- Extend Step 3 findings CA documentation fields so Minor/Major NC details can be viewed/edited after reopening.
-- Adds: Risk justification, Classification justification, Objective evidence list (JSON).

ALTER TABLE audit_plan_findings
  ADD COLUMN IF NOT EXISTS risk_justification text,
  ADD COLUMN IF NOT EXISTS justification_for_classification text,
  ADD COLUMN IF NOT EXISTS objective_evidence jsonb;

