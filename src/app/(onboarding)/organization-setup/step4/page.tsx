"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Step4Schema, Step4SchemaType } from "@/schemas/onboarding/step4Schema";

import { Input } from "@/components/ui/input";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

import { useRouter } from "next/navigation";
import { useOnboardingStore } from "@/store/onboardingStore";
import { setOnboardingStepReached } from "@/lib/onboarding-proxy";

const Step4 = () => {
  const router = useRouter();

  const saved = useOnboardingStore((s) => s.data.step4);
  const updateStep = useOnboardingStore((s) => s.updateStep);

  const form = useForm<Step4SchemaType>({
    resolver: zodResolver(Step4Schema),
    defaultValues: saved || {
      baseCurrency: "",
      fiscalYearStart: "",
      defaultTaxRate: "",
      paymentTerms: "",
      chartOfAccountsTemplate: "",
      defaultAssetAccount: "",
      defaultRevenueAccount: "",
      defaultExpenseAccount: "",
    },
  });

  const onSubmit = async (values: Step4SchemaType) => {
    updateStep("step4", values);
    await setOnboardingStepReached(5);
    router.push("/organization-setup/step5");
  };

  return (
    <Form {...form}>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold">Financial Setup</h1>
          <p className="text-sm text-muted-foreground">Configure your financial setup settings</p>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Base Currency */}
            <FormField
              control={form.control}
              name="baseCurrency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Base Currency</FormLabel>
                  <FormControl>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="USD - US Dollar" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="usd">USD - US Dollar</SelectItem>
                        <SelectItem value="eur">EUR - Euro</SelectItem>
                        <SelectItem value="gbp">GBP - British Pound</SelectItem>
                        <SelectItem value="pkr">PKR - Pakistani Rupee</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Fiscal Year */}
            <FormField
              control={form.control}
              name="fiscalYearStart"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fiscal Year Start</FormLabel>
                  <FormControl>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="January" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="january">January</SelectItem>
                        <SelectItem value="april">April</SelectItem>
                        <SelectItem value="july">July</SelectItem>
                        <SelectItem value="october">October</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Tax Rate */}
            <FormField
              control={form.control}
              name="defaultTaxRate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Default Tax Rate (%)</FormLabel>
                  <FormControl><Input placeholder="30" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Payment Terms */}
            <FormField
              control={form.control}
              name="paymentTerms"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Default Payment Terms (days)</FormLabel>
                  <FormControl><Input placeholder="30" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

          </div>

          {/* Chart of Accounts */}
          <div>
            <FormField
              control={form.control}
              name="chartOfAccountsTemplate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Chart of Accounts Template</FormLabel>
                  <FormControl>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Standard Business" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="standard">Standard Business</SelectItem>
                        <SelectItem value="nonprofit">Nonprofit</SelectItem>
                        <SelectItem value="manufacturing">Manufacturing</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Accounts */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

            <FormField
              control={form.control}
              name="defaultAssetAccount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Default Asset Account</FormLabel>
                  <FormControl><Input placeholder="1000 - Cash" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="defaultRevenueAccount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Default Revenue Account</FormLabel>
                  <FormControl><Input placeholder="4000 - Sales" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="defaultExpenseAccount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Default Expense Account</FormLabel>
                  <FormControl><Input placeholder="5000 - Operating Expense" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

          </div>

          <div className="flex justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/organization-setup/step3")}
            >
              Previous
            </Button>

            <div className="flex gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={async () => { await setOnboardingStepReached(5); router.push("/organization-setup/step5"); }}
              >
                Skip Step
              </Button>

              <Button type="submit" variant="default">
                Next
              </Button>
            </div>
          </div>
        </form>
      </div>
    </Form>
  );
};

export default Step4;

