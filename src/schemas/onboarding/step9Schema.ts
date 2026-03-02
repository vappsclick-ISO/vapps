import { z } from "zod";

export const step9Schema = z.object({
  require2FA: z.boolean(),
  ipWhitelisting: z.boolean(),
  sessionTimeout: z.boolean(),

  passwordPolicy: z.string().min(1, "Password policy is required"),
  sessionDuration: z.string().min(1, "Session duration is required"),

  logAllActions: z.boolean(),
  logRetention: z.string().min(1, "Log retention period is required"),

  backupFrequency: z.string().min(1, "Backup frequency is required"),
  backupRetention: z.string().min(1, "Backup retention is required"),
});

export type Step9Values = z.infer<typeof step9Schema>;
