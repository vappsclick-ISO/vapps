"use client";

import React from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Step3Values, step3Schema } from "@/schemas/onboarding/step3Schema";

import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

import { useRouter } from "next/navigation";
import { useOnboardingStore } from "@/store/onboardingStore";
import { setOnboardingStepReached } from "@/lib/onboarding-proxy";

export default function Step3Page() {
  const router = useRouter();

  const data = useOnboardingStore((s) => s.data.step3);
  const updateStep = useOnboardingStore((s) => s.updateStep);

  const form = useForm<Step3Values>({
    resolver: zodResolver(step3Schema),
    defaultValues: {
      leaders: data.leaders?.length
        ? data.leaders
        : [{ name: "", role: "", level: "Executive", email: "" }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    name: "leaders",
    control: form.control,
  });

  const addLeader = () =>
    append({ name: "", role: "", level: "Executive", email: "" });

  const onSubmit = async (values: Step3Values) => {
    // Filter out empty entries (entries with no name)
    const filteredLeaders = values.leaders.filter(
      l => l.name && l.name.trim().length > 0 && l.role && l.role.trim().length > 0
    );
    updateStep("step3", { leaders: filteredLeaders.length > 0 ? filteredLeaders : [] });
    await setOnboardingStepReached(4);
    router.push("/organization-setup/step4");
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Leadership Structure</h2>
      <p className="text-gray-600">Configure your leadership structure settings</p>

      <h3 className="text-xl font-semibold mt-4">Add Leadership Roles</h3>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {fields.map((field, index) => (
            <div key={field.id} className="relative border rounded-lg p-4">
              {fields.length > 1 && (
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="absolute right-2 top-2 text-red-500 hover:text-red-700"
                >
                  <Trash2 size={16} />
                </button>
              )}

              <div className="grid grid-cols-4 gap-4">
                {/* Name */}
                <FormField
                  control={form.control}
                  name={`leaders.${index}.name`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Role */}
                <FormField
                  control={form.control}
                  name={`leaders.${index}.role`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role *</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter role" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Level */}
                <FormField
                  control={form.control}
                  name={`leaders.${index}.level`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Level *</FormLabel>
                      <FormControl>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select level" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Executive">Executive</SelectItem>
                            <SelectItem value="Senior">Senior</SelectItem>
                            <SelectItem value="Mid">Mid</SelectItem>
                            <SelectItem value="Junior">Junior</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Leader Email */}
                <FormField
                  control={form.control}
                  name={`leaders.${index}.email`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="email@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          ))}

          {/* Add Leader */}
          <Button type="button" onClick={addLeader} className="mt-2">
            + Add Leader
          </Button>

          {/* Submit */}
          <div className="flex justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/organization-setup/step2")}
            >
              Previous
            </Button>

            <div className="flex gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={async () => { await setOnboardingStepReached(4); router.push("/organization-setup/step4"); }}
              >
                Skip Step
              </Button>

              <Button type="submit" variant="default">
                Next
              </Button></div>
          </div>
        </form>
      </Form>
    </div>
  );
}
