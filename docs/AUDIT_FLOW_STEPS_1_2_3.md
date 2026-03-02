# Audit Flow – Steps 1–3 (Summary)

This document describes how the audit flow works for Steps 1–3, which tables are used, and how status changes. **No UI layout or design was changed**; only flow logic and backend were added or wired.

---

## 1. Program Responsible Person = Auditee

- In **Step 1**, the person selected as **Responsible Owner (Auditee)** is the **Program Responsible Person**.
- That user is stored in **`audit_programs.program_owner_user_id`** and is treated as the **Auditee** for that audit (and for the audit plan created from that program).
- The same `program_owner_user_id` is used when creating an audit plan: **`audit_plans.auditee_user_id`** is set from the program’s `program_owner_user_id`.

---

## 2. Flow for Steps 1–3

### Step 1 – Lead Auditor Creates Program

- Lead Auditor (current user with Auditor role) creates the **audit program**.
- Saves: sites, process, **program owner (auditee)**, lead auditor, period, purpose, criteria, risks, schedule, KPIs, reviews.
- **Tables:** `audit_programs`, `audit_program_sites`, `audit_program_risks`, `audit_program_schedule`, `audit_program_kpis`, `audit_program_reviews`.
- **Status in DB:** No “status” on program; it’s the master record. After save, user is sent to Step 2 with `?programId=...`.

### Step 2 – Lead Auditor Creates Audit Plan

- Lead Auditor fills the audit plan (option A/B/C, criteria, scope, auditors, etc.).
- **Lead Auditor** = creator (known from session).
- **Auditee** = program’s responsible person (from program, not re-selected in Step 2).
- **Auditors** are assigned in the “Auditor Assignment” section (search and select users with Auditor role).
- **Generate Audit Plan** button:
  - Creates one **audit plan** linked to the current program.
  - Sets **`audit_plans.status`** = `plan_submitted_to_auditee`.
  - Sets **`audit_plans.plan_submitted_at`** = now.
  - Copies **auditee_user_id** from program’s **program_owner_user_id**.
  - Inserts rows into **`audit_plan_assignments`** for each assigned auditor.
  - Then **redirects** the Lead Auditor to the **main Audit Table** (`/dashboard/[orgId]/audit`).

### Main Audit Table

- **Data source:** `GET /api/organization/[orgId]/audit/plans` returns plans where the current user is either:
  - **lead_auditor_user_id**, or  
  - in **audit_plan_assignments** (assigned auditor).
- Table shows those plans (mapped into the existing table columns; no UI structure change).
- **Clicking a row** (or “Edit Audit”) opens **Step 3** with:
  - `?auditPlanId=...&programId=...&criteria=...`
- So **assigned auditors** see audits assigned to them and open Step 3 (Audit Findings) directly.

### Step 3 – Audit Findings (Checklist)

- **Opened from main table:** URL has **auditPlanId**; plan and (if needed) program are loaded; **criteria** comes from plan or program; checklist questions load from that criteria; saved **findings** (if any) are loaded into the grid.
- **Opened from Step 2 (Save & Continue):** URL has **programId** and **criteria**; no plan yet; checklist still loads by criteria (no “Save and return to table” or “Submit to Auditee” until a plan exists).
- Auditor:
  - Fills **status** for each question (Compliant, Major NC, Minor NC, etc.).
  - Can **search** questions and **add manual** rows.
- **SAVE & CONTINUE CHECKLIST LOOP** (when **auditPlanId** is present):
  - Saves current checklist rows to **`audit_plan_findings`** (PUT plan findings API).
  - Redirects to **main audit table**.
- **SUBMIT TO AUDITEE** (when **auditPlanId** is present):
  - Saves findings to **`audit_plan_findings`**.
  - Sets **`audit_plans.status`** = **`findings_submitted_to_auditee`** and **findings_submitted_at** = now.
  - Redirects to main audit table.
  - **After this**, the auditor can do nothing more: “Submit to Auditee” and “Save & Continue Checklist Loop” are **disabled** when **planStatus === findings_submitted_to_auditee**.

---

## 3. How Status Is Stored in Tables

| Table / field | When it is set | Meaning |
|----------------|----------------|--------|
| **audit_programs** | Step 1 save | Program record. **program_owner_user_id** = Auditee (Program Responsible Person). **lead_auditor_user_id** = Lead Auditor. No “status” column. |
| **audit_plans** | Step 2 “Generate Audit Plan” | One row per audit instance. **status** = `plan_submitted_to_auditee` when Lead Auditor submits; **plan_submitted_at** = now. **auditee_user_id** copied from program. **lead_auditor_user_id** from program. |
| **audit_plan_assignments** | Step 2 “Generate Audit Plan” | One row per assigned auditor (**user_id**). Used so the main table can show “my” plans (lead or assigned). |
| **audit_plans.status** | Step 3 “Submit to Auditee” | Updated to **`findings_submitted_to_auditee`**; **findings_submitted_at** = now. Used to disable further edits and to show “Success” / completed in the main table. |
| **audit_plan_findings** | Step 3 “Save & Continue Checklist Loop” or “Submit to Auditee” | One row per checklist row (standard, clause, requirement, question, evidence_seen, status). Replaced in full on each save. |

---

## 4. Checklist Behavior in Step 3

- **Questions:** Loaded from predefined checklists (e.g. ISO 9001, ISO 14001) based on **criteria** (from Step 2 / plan).
- **Criteria source when opened from main table:** **audit_plans.criteria** or program’s **audit_criteria** mapped to checklist key.
- Auditor **fills status** per question (Compliant, Not audited, Major NC, Minor NC, OFI, Positive, NA, Missing).
- **Search** filters rows by clause/question/requirement (no UI change).
- **Manual rows** can be added; they are saved with the rest to **audit_plan_findings**.
- **CA / Next** buttons in the grid are unchanged in behavior; they are part of the existing checklist UI.

---

## 5. What Was Implemented (No UI Change)

- **Migration 014:** `audit_plans`, `audit_plan_assignments`, `audit_plan_findings`.
- **APIs:** create plan (POST plans), list plans (GET plans), get plan (GET plan by id), update plan status (PATCH plan), get/put findings (GET/PUT plan findings).
- **Step 2:** “Generate Audit Plan” creates plan, assigns auditors, sets status `plan_submitted_to_auditee`, redirects to `/dashboard/[orgId]/audit`.
- **Main audit table:** Fetches plans from API (current user as lead or assigned), maps to existing columns, row click / Edit opens Step 3 with `auditPlanId`, `programId`, `criteria`.
- **Step 3:** Reads **auditPlanId** from URL; loads plan and saved findings; “Save & Continue Checklist Loop” saves findings and returns to table; “Submit to Auditee” saves findings, sets **findings_submitted_to_auditee**, redirects to table; both buttons disabled when status is already **findings_submitted_to_auditee**.

---

## 6. Run Migration Before Testing

Apply tenant migration **014** so that `audit_plans`, `audit_plan_assignments`, and `audit_plan_findings` exist. Then test the full flow: Step 1 → Step 2 → Generate Audit Plan → main table → open plan → Step 3 → Save and return, or Submit to Auditee, and confirm status and locking behavior.
