-- Add CA (Corrective Action) documentation fields for Major/Minor nonconformity findings.
-- Step 3: when status is Major or Minor NC, user documents Evidence Seen, Statement of Nonconformity, Risk Severity.

ALTER TABLE audit_plan_findings
  ADD COLUMN IF NOT EXISTS statement_of_nonconformity text,
  ADD COLUMN IF NOT EXISTS risk_severity text;
