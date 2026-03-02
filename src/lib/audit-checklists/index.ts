/**
 * Audit checklist questions by criteria.
 * Maps Step 2 Audit Criteria (display names) to predefined question sets.
 * Questions are from official ISO 9001 (36v3) and ISO 14001 (37v3) compliance documents.
 */

export const CRITERIA_TO_CHECKLIST_KEY: Record<string, string> = {
  "ISO 9001 QUALITY": "iso-9001",
  "ISO 14001 ENVIRONMENT": "iso-14001",
  "ISO 45001 HEALTH & SAFETY": "iso-45001",
  "ISO 27001 INFORMATION SECURITY": "iso-27001",
  "IATF 16949": "iatf-16949",
  "ISO 22000": "iso-22000",
  "ISO 20000-1": "iso-20000-1",
  "ISO 50001": "iso-50001",
  "ISO 21001": "iso-21001",
  "ISO 22301": "iso-22301",
  "ISO 42001": "iso-42001",
  "ISO 37001": "iso-37001",
  "ISO 13485": "iso-13485",
  "ISO 20400": "iso-20400",
  "ISO 26000": "iso-26000",
  "ISO 30415": "iso-30415",
  "ESG & SUSTAINABILITY (GRI / IFRS S1/S2)": "esg",
};

/** Program-level audit criteria (Step 1) to Step 2 display criteria for checklist derivation. */
export const PROGRAM_CRITERIA_TO_CHECKLIST_KEY: Record<string, string> = {
  iso: "iso-9001",
  esg: "esg",
  legal: "iso-27001",
};
