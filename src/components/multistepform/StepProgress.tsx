import React from "react";

interface StepProgressProps {
    step: number;
    total: number;
}

export default function StepProgress({ step, total }: StepProgressProps) {
    const percentage = Math.round((step / total) * 100);

    return (
        <div className="w-full py-4">
            <div className="container mx-auto px-5">
                <div className="flex flex-col gap-2">
                    <div className="flex justify-between">
                        <div className="text-sm font-medium text-gray-700">
                            Step {step} of {total}
                        </div>

                        <div className="text-sm font-medium text-gray-700">
                            {percentage}% Complete
                        </div>
                    </div>

                    <div className="w-full">
                        <div className="h-2 w-full bg-[#E6E6E6] rounded-full overflow-hidden">
                            <div
                                className="h-full rounded-full transition-all"
                                style={{ width: `${percentage}%`, backgroundColor: "#22B323" }}
                            ></div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}