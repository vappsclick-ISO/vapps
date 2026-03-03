import { z } from "zod";

const customerSchema = z.object({
  name: z.string(),
  email: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
});

const vendorSchema = z.object({
  name: z.string(),
  email: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
});

export const step6Schema = z.object({
  activeTab: z.enum(["customers", "vendors"]),
  customers: z.array(customerSchema).default([]),
  vendors: z.array(vendorSchema).default([]),
});

export type Step6Values = z.infer<typeof step6Schema>;
