"use client";

import React from "react";
// import { useSiteStore } from "@/store/onboardingStore";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export default function CompletePage() {
  // const { data, reset } = useSiteStore();
  const router = useRouter();

  // const onDone = () => {
  //   reset();
  //   router.push("/");
  // };

  return (
    <div className="container mx-auto px-5 py-20 text-center">
      <h1 className="text-2xl font-bold mb-4">Organization setup complete</h1>
      <p className="text-gray-600 mb-6">You're all set. Click continue to go to your dashboard.</p>

      {/* <Button onClick={onDone}>Go to dashboard</Button> */}
    </div>
  );
}
