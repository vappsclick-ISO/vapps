import * as z from "zod";

export const Step4Schema = z.object({
  baseCurrency: z.string().min(1, "Base currency is required"),
  fiscalYearStart: z.string().min(1, "Fiscal year start is required"),
  defaultTaxRate: z.string().min(1, "Tax rate is required"),
  paymentTerms: z.string().min(1, "Payment terms are required"),
  chartOfAccountsTemplate: z.string().min(1, "COA template required"),
  defaultAssetAccount: z.string().min(1, "Asset account required"),
  defaultRevenueAccount: z.string().min(1, "Revenue account required"),
  defaultExpenseAccount: z.string().min(1, "Expense account required"),
});

export type Step4SchemaType = z.infer<typeof Step4Schema>;

