"use client";

import { useEffect, useRef } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { step6Schema, Step6Values } from "@/schemas/onboarding/step6Schema";

import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import { useRouter } from "next/navigation";
import { setOnboardingStepReached } from "@/lib/onboarding-proxy";
import { useOnboardingStore } from "@/store/onboardingStore";

const Step6 = () => {
  const router = useRouter();
  const saved = useOnboardingStore((s) => s.data.step6);
  const updateStep = useOnboardingStore((s) => s.updateStep);

  const form = useForm<Step6Values>({
    defaultValues: saved || {
      activeTab: "customers",
    },
  });

  const { fields: customerFields, append: addCustomer, remove: removeCustomer } = useFieldArray({
    control: form.control,
    name: "customers",
  });

  const { fields: vendorFields, append: addVendor, remove: removeVendor } = useFieldArray({
    control: form.control,
    name: "vendors",
  });

  const tab = form.watch("activeTab");
  const ranRef = useRef({ customers: false, vendors: false });

  useEffect(() => {
    if (tab === "customers" && customerFields.length === 0 && !ranRef.current.customers) {
      addCustomer({ name: "", email: "", phone: "", address: "" });
      ranRef.current.customers = true;
    }

    if (tab === "vendors" && vendorFields.length === 0 && !ranRef.current.vendors) {
      addVendor({ name: "", email: "", phone: "", address: "" });
      ranRef.current.vendors = true;
    }
  }, [tab, customerFields.length, vendorFields.length, addCustomer, addVendor]);


  const onSubmit = async (values: Step6Values) => {
    const activeTab = values.activeTab || "customers";

    if (activeTab === "customers") {
      const hasValidCustomer = values.customers?.some(c => c.name && c.name.trim().length > 0);
      if (!hasValidCustomer) {
        form.setError("customers.0.name", {
          type: "manual",
          message: "At least one customer name is required",
        });
        return;
      }
    } else if (activeTab === "vendors") {
      const hasValidVendor = values.vendors?.some(v => v.name && v.name.trim().length > 0);
      if (!hasValidVendor) {
        form.setError("vendors.0.name", {
          type: "manual",
          message: "At least one vendor name is required",
        });
        return;
      }
    }

    let filteredCustomers = values.customers || [];
    let filteredVendors = values.vendors || [];

    if (activeTab === "customers") {
      filteredCustomers = values.customers?.filter(c => c.name && c.name.trim().length > 0) || [];
      filteredVendors = values.vendors || [];
    } else if (activeTab === "vendors") {
      filteredVendors = values.vendors?.filter(v => v.name && v.name.trim().length > 0) || [];
      filteredCustomers = values.customers || [];
    }

    updateStep("step6", {
      activeTab,
      customers: filteredCustomers as any,
      vendors: filteredVendors as any,
    });
    await setOnboardingStepReached(7);
    router.push("/organization-setup/step7");
  };

  return (
    <>
      <h1 className="text-2xl font-bold mb-2">Customers & Vendors</h1>
      <p className="text-gray-600 mb-8">Configure your customers & vendors settings</p>

      <div className="flex mb-6">
        <div className="flex gap-3 p-1 bg-gray-100 border rounded-full">
          <Button
            type="button"
            variant={tab === "customers" ? "default" : "ghost"}
            className={`rounded-full px-4 ${tab === "customers" ? "bg-primary text-white" : ""}`}
            onClick={() => form.setValue("activeTab", "customers")}
          >
            Customers
          </Button>
          <Button
            type="button"
            variant={tab === "vendors" ? "default" : "ghost"}
            className={`rounded-full px-4 ${tab === "vendors" ? "bg-primary text-white" : ""}`}
            onClick={() => form.setValue("activeTab", "vendors")}
          >
            Vendors
          </Button>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-10">
          {tab === "customers" && (
            <>
              <h3 className="text-xl font-semibold">Add Customer</h3>
              {customerFields.map((field, index) => (
                <div key={field.id}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name={`customers.${index}.name`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Customer Name *</FormLabel>
                          <FormControl>
                            <Input placeholder="ABC Corp" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`customers.${index}.email`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input placeholder="contact@abccorp.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`customers.${index}.phone`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone</FormLabel>
                          <FormControl>
                            <Input placeholder="+1 555-0100" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`customers.${index}.address`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Address</FormLabel>
                          <FormControl>
                            <Input placeholder="123 Main St" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="mt-4 flex justify-end">
                    {customerFields.length > 1 && (
                      <Button variant="destructive" type="button" onClick={() => removeCustomer(index)}>
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              ))}

              <Button type="button" variant="outline" onClick={() => addCustomer({ name: "", email: "", phone: "", address: "" })}>
                + Add Customer
              </Button>
            </>
          )}

          {tab === "vendors" && (
            <>
              <h3 className="text-xl font-semibold">Add Vendor</h3>
              {vendorFields.map((field, index) => (
                <div key={field.id}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name={`vendors.${index}.name`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Vendor Name *</FormLabel>
                          <FormControl>
                            <Input placeholder="ABC Corp" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`vendors.${index}.email`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input placeholder="contact@abccorp.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`vendors.${index}.phone`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone</FormLabel>
                          <FormControl>
                            <Input placeholder="+1 555-0100" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`vendors.${index}.address`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Address</FormLabel>
                          <FormControl>
                            <Input placeholder="123 Main St" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="mt-4 flex justify-end">
                    {vendorFields.length > 1 && (
                      <Button variant="destructive" type="button" onClick={() => removeVendor(index)}>
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              ))}

              <Button type="button" variant="outline" onClick={() => addVendor({ name: "", email: "", phone: "", address: "" })}>
                + Add Vendor
              </Button>
            </>
          )}

          <div className="flex justify-between gap-3">
            <Button type="button" variant="outline" onClick={() => router.push("/organization-setup/step5")}>
              Previous
            </Button>

            <div className="flex gap-4">
              <Button type="button" variant="outline" onClick={async () => { await setOnboardingStepReached(7); router.push("/organization-setup/step7"); }}>
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

export default Step6;
