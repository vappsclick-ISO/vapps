"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { step9Schema, Step9Values } from "@/schemas/onboarding/step9Schema";

import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";

import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

import { useRouter } from "next/navigation";
import { setOnboardingStepReached } from "@/lib/onboarding-proxy";
import { useOnboardingStore } from "@/store/onboardingStore";

const Step9 = () => {
  const router = useRouter();
  const saved = useOnboardingStore((s) => s.data.step9);
  const updateStep = useOnboardingStore((s) => s.updateStep);

  const form = useForm<Step9Values>({
    resolver: zodResolver(step9Schema),
    defaultValues: saved || {
      require2FA: false,
      ipWhitelisting: false,
      sessionTimeout: false,
      passwordPolicy: "",
      sessionDuration: "",
      logAllActions: false,
      logRetention: "",
      backupFrequency: "",
      backupRetention: "",
    },
  });

  const onSubmit = async (values: Step9Values) => {
    updateStep("step9", values);
    await setOnboardingStepReached(10);
    router.push("/organization-setup/step10");
  };

  return (
    <>
      <h1 className="text-2xl font-bold mb-2">Security Settings</h1>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-10">
          <section>
            <div className="space-y-4">
              <FormField control={form.control} name="require2FA" render={({ field }) => (
                <FormItem className="flex justify-between items-center ">
                  <FormLabel>Require 2FA for all users</FormLabel>
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                </FormItem>
              )} />

              <FormField control={form.control} name="ipWhitelisting" render={({ field }) => (
                <FormItem className="flex justify-between items-center ">
                  <FormLabel>Restrict access to specific IP addresses</FormLabel>
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                </FormItem>
              )} />

              <FormField control={form.control} name="sessionTimeout" render={({ field }) => (
                <FormItem className="flex justify-between items-center ">
                  <FormLabel>Auto logout after inactivity</FormLabel>
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                </FormItem>
              )} />
            </div>
          </section>

          <section>
            <h3 className="text-xl font-semibold mb-3">Access Control</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField control={form.control} name="passwordPolicy" render={({ field }) => (
                <FormItem><FormLabel>Password Policy</FormLabel><FormControl><Input placeholder="Standard (10+ chars, mixed case)" {...field} /></FormControl><FormMessage /></FormItem>
              )} />

              <FormField control={form.control} name="sessionDuration" render={({ field }) => (
                <FormItem><FormLabel>Session Duration (minutes)</FormLabel><FormControl><Input placeholder="60" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
          </section>

          <section>
            <h3 className="text-xl font-semibold mb-3">Audit Logging</h3>
            <p className="text-gray-600 mb-3">Log All User Actions</p>

            <FormField control={form.control} name="logAllActions" render={({ field }) => (
              <FormItem className="flex justify-between items-center  mb-4"><FormLabel>Enable Logging</FormLabel><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>
            )} />

            <FormField control={form.control} name="logRetention" render={({ field }) => (
              <FormItem><FormLabel>Log Retention Period (days)</FormLabel><FormControl><Input placeholder="365" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
          </section>

          <section>
            <h3 className="text-xl font-semibold mb-3">Backup Configuration</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField control={form.control} name="backupFrequency" render={({ field }) => (
                <FormItem>
                  <FormLabel>Backup Frequency</FormLabel>
                  <FormControl>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Select frequency" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="backupRetention" render={({ field }) => (
                <FormItem><FormLabel>Backup Retention (days)</FormLabel><FormControl><Input placeholder="30" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
          </section>

          <section className="border p-4 rounded-md bg-[#FEFCE8]">
            <h3 className="text-lg font-semibold mb-2">Security Best Practices</h3>
            <ul className=" list-inside space-y-1 text-gray-700 text-sm">
              <li>Enable 2FA for enhanced security</li>
              <li>Use strict password policies for sensitive data</li>
              <li>Regularly review audit logs for suspicious activity</li>
              <li>Maintain multiple backup copies in different locations</li>
            </ul>
          </section>

          <div className="flex justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/organization-setup/step8")}
            >
              Previous
            </Button>

            <div className="flex gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={async () => { await setOnboardingStepReached(10); router.push("/organization-setup/step10"); }}
              >
                Skip Step
              </Button>

              <Button type="submit" variant="default">
                Next
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </>
  );
};

export default Step9;
