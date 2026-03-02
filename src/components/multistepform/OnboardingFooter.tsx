"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { setOnboardingStepReached } from "@/lib/onboarding-proxy";

export default function OnboardingFooter({
  currentStep,
  totalSteps
}: {
  currentStep: number;
  totalSteps: number;
}) {
  const router = useRouter();

  const goNext = async () => {
    if (currentStep < totalSteps) {
      await setOnboardingStepReached(currentStep + 1);
      router.push(`/organization-setup/step${currentStep + 1}`);
    }
  };

  const goPrev = () => {
    if (currentStep > 1) {
      router.push(`/organization-setup/step${currentStep - 1}`);
    }
  };

  const skip = async () => {
    if (currentStep < totalSteps) {
      await setOnboardingStepReached(currentStep + 1);
      router.push(`/organization-setup/step${currentStep + 1}`);
    }
  };

  const finish = async () => {
    await setOnboardingStepReached(10);
    router.push("/organization-setup/complete");
  };

  return (
    <div className="w-full bg-white py-4 mt-10">
      <div className="container mx-auto px-5 flex justify-between items-center">

        {currentStep > 1 ? (
          <Button variant="outline" onClick={goPrev}>
            Previous
          </Button>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-6">

          {currentStep < totalSteps && currentStep > 1 && (
            <button
              onClick={skip}
              className="text-[#0A0A0A] hover:underline text-sm"
            >
              Skip Step
            </button>
          )}

          {currentStep === totalSteps ? (
            <Button variant="default" onClick={finish}>
              Finish
            </Button>
          ) : (
            <Button variant="default" onClick={goNext}>
              Next
            </Button>
          )}
        </div>

      </div>
    </div>
  );
}
