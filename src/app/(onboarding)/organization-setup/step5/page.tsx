"use client";

import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { step5Schema, Step5Values } from "@/schemas/onboarding/step5Schema";

import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import { useRouter } from "next/navigation";
import { setOnboardingStepReached } from "@/lib/onboarding-proxy";
import { useOnboardingStore } from "@/store/onboardingStore";

const Step5 = () => {
  const router = useRouter();
  const saved = useOnboardingStore((s) => s.data.step5);
  const updateStep = useOnboardingStore((s) => s.updateStep);

  const form = useForm<Step5Values>({
    resolver: zodResolver(step5Schema),
    defaultValues: { products: saved.products?.length ? saved.products : [{ sku: "", name: "", category: "", unit: "", cost: "", reorder: "" }] },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "products" });

  const onSubmit = async (values: Step5Values) => {
    // Filter out empty entries (entries with no name)
    const filteredProducts = values.products.filter(
      p => p.name && p.name.trim().length > 0
    );
    updateStep("step5", { products: filteredProducts.length > 0 ? filteredProducts : [] });
    await setOnboardingStepReached(6);
    router.push("/organization-setup/step6");
  };

  return (
    <>
      <h1 className="text-2xl font-bold mb-2">Product & Inventory</h1>
      <p className="text-gray-600 mb-8">Configure your product & inventory settings</p>
      <h3 className="text-xl font-semibold mb-4">Add Products / Services</h3>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-10">
          {fields.map((field, index) => (
            <div key={field.id} className="">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormField control={form.control} name={`products.${index}.sku`} render={({ field }) => (
                  <FormItem><FormLabel>SKU</FormLabel><FormControl><Input placeholder="Enter SKU" {...field} /></FormControl><FormMessage /></FormItem>
                )} />

                <FormField control={form.control} name={`products.${index}.name`} render={({ field }) => (
                  <FormItem><FormLabel>Product Name *</FormLabel><FormControl><Input placeholder="Enter product name" {...field} /></FormControl><FormMessage /></FormItem>
                )} />

                <FormField control={form.control} name={`products.${index}.category`} render={({ field }) => (
                  <FormItem><FormLabel>Category</FormLabel><FormControl><Input placeholder="Enter category" {...field} /></FormControl><FormMessage /></FormItem>
                )} />

                <FormField control={form.control} name={`products.${index}.unit`} render={({ field }) => (
                  <FormItem><FormLabel>Unit of Measure</FormLabel><FormControl><Input placeholder="Enter unit (e.g. pcs, box)" {...field} /></FormControl><FormMessage /></FormItem>
                )} />

                <FormField control={form.control} name={`products.${index}.cost`} render={({ field }) => (
                  <FormItem><FormLabel>Unit Cost</FormLabel><FormControl><Input placeholder="Enter cost" {...field} /></FormControl><FormMessage /></FormItem>
                )} />

                <FormField control={form.control} name={`products.${index}.reorder`} render={({ field }) => (
                  <FormItem><FormLabel>Reorder Level</FormLabel><FormControl><Input placeholder="Enter reorder level (e.g. 20)" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>

              <div className="mt-4 flex justify-end">
                {fields.length > 1 && <Button type="button" variant="destructive" onClick={() => remove(index)}>Remove Product</Button>}
              </div>
            </div>
          ))}

          <Button type="button" variant="outline" onClick={() => append({ sku: "", name: "", category: "", unit: "", cost: "", reorder: "" })}>+ Add Another Product</Button>

          <div className="flex justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/organization-setup/step4")}
            >
              Previous
            </Button>

            <div className="flex gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={async () => { await setOnboardingStepReached(6); router.push("/organization-setup/step6"); }}
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

export default Step5;
