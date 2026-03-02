/**
 * Generates prisma/tenant-migrations/018_seed_default_audit_checklists.sql
 * from the five JSON checklist files. Run: node scripts/seed-audit-checklists-sql.js
 */
const fs = require("fs");
const path = require("path");

const CHECKLISTS = [
  { id: "a1000001-9001-4001-8001-000000000001", name: "ISO 9001 QUALITY", file: "iso-9001.json" },
  { id: "a1000002-1400-4002-8001-000000000002", name: "ISO 14001 ENVIRONMENT", file: "iso-14001.json" },
  { id: "a1000003-4500-4003-8001-000000000003", name: "ISO 45001 HEALTH & SAFETY", file: "iso-45001.json" },
  { id: "a1000004-2700-4004-8001-000000000004", name: "ISO 27001 INFORMATION SECURITY", file: "iso-27001.json" },
  { id: "a1000005-1694-4005-8001-000000000005", name: "IATF 16949", file: "iatf-16949.json" },
];

function escapeSql(s) {
  if (s == null || s === undefined) return "";
  return String(s).replace(/'/g, "''");
}

const jsonDir = path.join(__dirname, "..", "src", "lib", "audit-checklists");
const outPath = path.join(__dirname, "..", "prisma", "tenant-migrations", "018_seed_default_audit_checklists.sql");

const lines = [
  "-- Seed default audit checklists and questions (from hardcoded JSON).",
  "-- Run after 017_audit_checklists_questions.sql. Idempotent: only inserts when checklist has no questions.",
  "",
  "INSERT INTO audit_checklists (id, name)",
  "VALUES",
  CHECKLISTS.map((c) => `  ('${c.id}', '${escapeSql(c.name)}')`).join(",\n"),
  "ON CONFLICT (id) DO NOTHING;",
  "",
];

for (const checklist of CHECKLISTS) {
  const jsonPath = path.join(jsonDir, checklist.file);
  const raw = fs.readFileSync(jsonPath, "utf8");
  const items = JSON.parse(raw);
  if (items.length === 0) continue;

  lines.push(`-- ${checklist.name}: ${items.length} questions`);
  lines.push(
    "INSERT INTO audit_checklist_questions (audit_checklist_id, clause, subclause, requirement, question, evidence_example, sort_order)"
  );
  lines.push("SELECT * FROM (VALUES");
  const valueRows = items.map(
    (q, i) =>
      `  ('${checklist.id}'::uuid, '${escapeSql(q.clause)}', '${escapeSql(q.subclause)}', '${escapeSql(q.requirement)}', '${escapeSql(q.question)}', '${escapeSql(q.evidenceExample)}', ${i})`
  );
  lines.push(valueRows.join(",\n"));
  lines.push(") AS v(audit_checklist_id, clause, subclause, requirement, question, evidence_example, sort_order)");
  lines.push(
    `WHERE (SELECT COUNT(*) FROM audit_checklist_questions WHERE audit_checklist_id = '${checklist.id}'::uuid) = 0;`
  );
  lines.push("");
}

fs.writeFileSync(outPath, lines.join("\n"), "utf8");
console.log("Written:", outPath);
