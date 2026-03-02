"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Header from "@/components/common/Header";
import StepProgress from "@/components/multistepform/StepProgress";
import StepTabs from "@/components/multistepform/StepTabs";
import OnboardingFooter from "@/components/multistepform/OnboardingFooter";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const match = pathname.match(/step(\d+)/);
  const currentStep = match ? Number(match[1]) : 1;
  const totalSteps = 10;

  // Update proxy cookie when user lands on a step (highest step reached; allows /complete after step10)
  useEffect(() => {
    if (currentStep >= 2 && currentStep <= 10) {
      fetch("/api/organization-setup/complete-step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: currentStep }),
      }).catch(() => {});
    }
  }, [currentStep]);

  return (
    <>
      <Header />

      <StepProgress step={currentStep} total={totalSteps} />
      <StepTabs currentStep={currentStep} />

      <div className="container mx-auto px-5 py-10 border border-[#D4D4D4] rounded-2xl">
        {children}
      </div>

      <OnboardingFooter currentStep={currentStep} totalSteps={totalSteps} />
    </>
  );
}
