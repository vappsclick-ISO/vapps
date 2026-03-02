-- Step 2 form data: TPCC, calendar options, lead auditor comments, AMRC rows.
ALTER TABLE audit_plans
ADD COLUMN IF NOT EXISTS step_2_data jsonb;

COMMENT ON COLUMN audit_plans.step_2_data IS 'Step 2 form: tpccRegisteredProcess, tpccAuditReference, rescheduleAuditPlan, leadAuditorComments, amrcRows, actualDate.';
