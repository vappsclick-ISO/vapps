import { z } from "zod";

/** Slug: lowercase letters, numbers, hyphens only; no spaces; 2–50 chars */
const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const step1Schema = z.object({
  slug: z
    .string()
    .min(1, "Organization URL slug is required")
    .transform((s) => s.trim())
    .pipe(
      z
        .string()
        .min(2, "Slug must be at least 2 characters")
        .max(50, "Slug must be at most 50 characters")
        .refine((s) => !/\s/.test(s), "Spaces are not allowed in the slug")
        .toLowerCase()
        .regex(slugRegex, "Only lowercase letters, numbers, and hyphens allowed (no spaces)")
    ),
  companyName: z.string().min(1, "Company name is required"),
  registrationId: z.string().optional(),
  address: z.string().optional(),
  contactName: z.string().optional(),
  contactEmail: z.string().email().optional(),
  phone: z.string().optional(),
  website: z.string().optional(),
  industry: z.string().optional(),
});

export type Step1Values = z.infer<typeof step1Schema>;
