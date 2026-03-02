import { z } from "zod";

export const leaderSchema = z.object({
  name: z.string().min(1, "Name is required"),
  role: z.string().min(1, "Role is required"),
  level: z.string().min(1, "Level is required"),
  email: z.string().email().optional(),
});

export const step3Schema = z.object({
  leaders: z.array(leaderSchema),
});

export type Step3Values = z.infer<typeof step3Schema>;
export type LeaderValues = z.infer<typeof leaderSchema>;
