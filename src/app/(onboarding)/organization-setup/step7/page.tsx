"use client";

import { useForm, SubmitHandler, Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { step7Schema, Step7Values } from "@/schemas/onboarding/step7Schema";

import {
    Form,
    FormField,
    FormItem,
    FormLabel,
    FormControl,
    FormMessage,
} from "@/components/ui/form";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useRouter } from "next/navigation";
import { useOnboardingStore } from "@/store/onboardingStore";
import { setOnboardingStepReached } from "@/lib/onboarding-proxy";
import { Button } from "@/components/ui/button";
const Step7 = () => {
    const router = useRouter();
    const saved = useOnboardingStore((s) => s.data.step7);
    const updateStep = useOnboardingStore((s) => s.updateStep);
    const form = useForm<Step7Values>({
        resolver: zodResolver(step7Schema) as unknown as Resolver<Step7Values>,
        defaultValues: {
            multiLevelApprovals: false,
            automaticTaskAssignment: false,

            criticalSLA: "",
            highPrioritySLA: "",
            mediumPrioritySLA: "",
            lowPrioritySLA: "",

            emailNotifications: true,
            inAppNotifications: true,
            smsNotifications: false,

            escalationRules: "",
        },
    });

    const onSubmit = async (values: Step7Values) => {
        updateStep("step7", values);
        await setOnboardingStepReached(8);
        router.push("/organization-setup/step8");
    };
    return (
        <>
            <h1 className="text-2xl font-bold mb-2">Operational Parameters</h1>
            <p className="text-gray-600 mb-8">
                Configure your operational parameters settings
            </p>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-10">

                    {/* Workflow Configuration */}
                    <section>
                        <h3 className="text-xl font-semibold mb-5">Workflow Configuration</h3>

                        <div className="space-y-4">

                            {/* Multi Level Approvals */}
                            <FormField
                                control={form.control}
                                name="multiLevelApprovals"
                                render={({ field }) => (
                                    <div className="flex justify-between items-center ">
                                        <FormLabel>Multi-level Approvals</FormLabel>
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    </div>
                                )}
                            />

                            {/* Automatic Task Assignment */}
                            <FormField
                                control={form.control}
                                name="automaticTaskAssignment"
                                render={({ field }) => (
                                    <div className="flex justify-between items-center ">
                                        <FormLabel>Automatic Task Assignment</FormLabel>
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    </div>
                                )}
                            />

                        </div>
                    </section>

                    {/* SLA Configuration */}
                    <section>
                        <h3 className="text-xl font-semibold mb-5">SLA Configuration</h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                            <FormField
                                control={form.control}
                                name="criticalSLA"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Critical Issue SLA (hours)</FormLabel>
                                        <FormControl>
                                            <Input placeholder="4" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="highPrioritySLA"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>High Priority SLA (hours)</FormLabel>
                                        <FormControl>
                                            <Input placeholder="24" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="mediumPrioritySLA"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Medium Priority SLA (hours)</FormLabel>
                                        <FormControl>
                                            <Input placeholder="72" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="lowPrioritySLA"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Low Priority SLA (hours)</FormLabel>
                                        <FormControl>
                                            <Input placeholder="168" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                        </div>
                    </section>

                    {/* Notification Preferences */}
                    <section>
                        <h3 className="text-xl font-semibold mb-5">Notification Preferences</h3>

                        <div className="space-y-4">

                            {/* Email Notifications */}
                            <FormField
                                control={form.control}
                                name="emailNotifications"
                                render={({ field }) => (
                                    <div className="flex justify-between items-center ">
                                        <FormLabel>Email Notifications</FormLabel>
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    </div>
                                )}
                            />

                            {/* In-App Notifications */}
                            <FormField
                                control={form.control}
                                name="inAppNotifications"
                                render={({ field }) => (
                                    <div className="flex justify-between items-center ">
                                        <FormLabel>In-App Notifications</FormLabel>
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    </div>
                                )}
                            />

                            {/* SMS Notifications (Critical Only) */}
                            <FormField
                                control={form.control}
                                name="smsNotifications"
                                render={({ field }) => (
                                    <div className="flex justify-between items-center ">
                                        <FormLabel>SMS Notifications (Critical Only)</FormLabel>
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    </div>
                                )}
                            />

                            {/* Escalation Rules */}
                            <FormField
                                control={form.control}
                                name="escalationRules"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Escalation Rules</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                placeholder="Define escalation rules for overdue tasks and unresolved issues..."
                                                className="min-h-[130px]"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                        </div>
                    </section>

                    <div className="flex justify-between gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => router.push("/organization-setup/step6")}
                        >
                            Previous
                        </Button>

                        <div className="flex gap-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={async () => { await setOnboardingStepReached(8); router.push("/organization-setup/step8"); }}
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
}

export default Step7
