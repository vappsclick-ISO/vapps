"use client";

import React from "react";
import { usePathname } from "next/navigation";

const steps = [
  "Company Information",
  "Sites & Processes",
  "Leadership Structure",
  "Financial Setup",
  "Product & Inventory",
  "Customers & Vendors",
  "Operational Parameters",
  "KPI & Reporting",
  "Security & Backup",
  "Review & Finish",
];

interface StepTabsProps {
  currentStep: number;
}

export default function StepTabs({ currentStep }: StepTabsProps) {
  return (
    <div className="w-full py-6">
      <div className="container mx-auto px-5 overflow-x-auto">
        <div className="min-w-max grid grid-cols-10 gap-8 sm:gap-12">
          {steps.map((label, index) => {
            const step = index + 1;
            const isActive = currentStep === step;
            return (
              <div key={step} className="flex flex-col items-center">
              
                <div
                  className={`w-10 h-10 flex items-center justify-center rounded-full text-white font-medium ${
                    isActive ? "bg-[#22B323]" : "bg-[#D4D4D4]"
                  }`}
                >
                  {step}
                </div>

                <p className="text-center mt-2 text-xs font-medium text-gray-700 w-20 leading-tight">
                  {label}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}