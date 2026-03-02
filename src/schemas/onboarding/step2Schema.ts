import { z } from "zod";

export const step2Schema = z.object({
  sites: z.array(
    z.object({
      siteName: z.string().min(1, "Site Name is required"),
      siteCode: z.string().optional(), // Auto-generated if not provided
      location: z.string().min(1, "Location is required"),
      processes: z.array(z.string()).optional(), // <-- plural
    })
  ),
});

export type Step2Values = z.infer<typeof step2Schema>;
