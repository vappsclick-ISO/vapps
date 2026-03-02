import { z } from "zod";

export const step1Schema = z.object({
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
