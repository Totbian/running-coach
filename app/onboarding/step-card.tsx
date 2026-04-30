"use client";

import { OnboardingStep, StepData } from "@/lib/onboarding-steps";
import { cn } from "@/lib/utils";

interface StepCardProps {
  step: OnboardingStep;
  isCurrent: boolean;
  data?: StepData;
}

export function StepCard({ step, isCurrent, data }: StepCardProps) {
  const isCompleted = !!data;

  return (
    <div
      className={cn(
        "flex items-center gap-2 p-2 border text-left transition-all",
        isCurrent && "border-primary bg-primary/5",
        isCompleted && !isCurrent && "opacity-70",
        !isCompleted && !isCurrent && "opacity-40"
      )}
    >
      <span className="text-base">{step.icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium">{step.title}</p>
        {data && (
          <p className="text-[10px] text-muted-foreground truncate">
            {data.skipped ? "Skipped" : data.data}
          </p>
        )}
      </div>
      {isCompleted && <span className="text-xs">✓</span>}
      {step.optional && !isCompleted && !isCurrent && (
        <span className="text-[10px] text-muted-foreground">opt</span>
      )}
    </div>
  );
}
