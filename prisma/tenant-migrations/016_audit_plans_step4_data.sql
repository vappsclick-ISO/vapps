-- Step 4 (Auditee Corrective Action) form data stored as JSON.
ALTER TABLE audit_plans
ADD COLUMN IF NOT EXISTS step_4_data jsonb;

COMMENT ON COLUMN audit_plans.step_4_data IS 'Auditee corrective action form data (S1–S7, risk, comments, file keys).';
