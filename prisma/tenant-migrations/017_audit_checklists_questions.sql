-- Audit checklists (e.g. ISO 9001 Quality) per organization tenant.
-- Admin creates checklist entries in Org Settings > Audit Checklist; each has many questions.
CREATE TABLE IF NOT EXISTS audit_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_checklists_name ON audit_checklists(name);

-- Questions under a checklist: clause, subclause, requirement, question, evidence_example.
CREATE TABLE IF NOT EXISTS audit_checklist_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_checklist_id uuid NOT NULL REFERENCES audit_checklists(id) ON DELETE CASCADE,
  clause text NOT NULL DEFAULT '',
  subclause text NOT NULL DEFAULT '',
  requirement text NOT NULL DEFAULT '',
  question text NOT NULL DEFAULT '',
  evidence_example text NOT NULL DEFAULT '',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_checklist_questions_checklist ON audit_checklist_questions(audit_checklist_id);

-- Optional: link audit plan to a checklist (when set, Step 3 loads questions from this checklist).
ALTER TABLE audit_plans ADD COLUMN IF NOT EXISTS checklist_id uuid REFERENCES audit_checklists(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_audit_plans_checklist ON audit_plans(checklist_id);
