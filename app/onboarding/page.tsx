"use client";

import { useState, useCallback } from "react";
import { ONBOARDING_STEPS, StepData, StepId } from "@/lib/onboarding-steps";
import { VoiceSession } from "./voice-session";
import { StepCard } from "./step-card";
import { Button } from "@/components/ui/button";

export default function OnboardingPage() {
  const [isConnected, setIsConnected] = useState(false);
  const [currentStep, setCurrentStep] = useState<StepId>("GOAL");
  const [completedSteps, setCompletedSteps] = useState<StepData[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [transcript, setTranscript] = useState<string>("");

  const handleStepUpdate = useCallback((stepData: StepData) => {
    setCompletedSteps((prev) => {
      const existing = prev.findIndex((s) => s.step === stepData.step);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = stepData;
        return updated;
      }
      return [...prev, stepData];
    });

    // Move to next step
    const currentIndex = ONBOARDING_STEPS.findIndex((s) => s.id === stepData.step);
    if (currentIndex < ONBOARDING_STEPS.length - 1) {
      setCurrentStep(ONBOARDING_STEPS[currentIndex + 1].id);
    }
  }, []);

  const handleComplete = useCallback(() => {
    setIsComplete(true);
  }, []);

  const handleTranscript = useCallback((text: string) => {
    setTranscript(text);
  }, []);

  return (
    <div className="min-h-svh bg-background flex flex-col">
      {/* Header */}
      <header className="border-b px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-lg font-semibold">Running Coach</h1>
          <span className="text-sm text-muted-foreground">
            Step {ONBOARDING_STEPS.findIndex((s) => s.id === currentStep) + 1} of{" "}
            {ONBOARDING_STEPS.length}
          </span>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 px-6 py-8">
        <div className="max-w-4xl mx-auto">
          {!isConnected ? (
            /* Start screen */
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
              <div className="text-6xl mb-6">🏃</div>
              <h2 className="text-3xl font-bold mb-3">Let&apos;s Get Started</h2>
              <p className="text-muted-foreground max-w-md mb-8">
                I&apos;ll ask you a few questions by voice to build your personalized
                training plan. Just talk naturally - I&apos;ll listen and update the
                screen as we go.
              </p>
              <Button size="lg" onClick={() => setIsConnected(true)}>
                Start Voice Onboarding
              </Button>
              <p className="text-xs text-muted-foreground mt-4">
                Requires microphone access
              </p>
            </div>
          ) : isComplete ? (
            /* Complete screen */
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
              <div className="text-6xl mb-6">✅</div>
              <h2 className="text-3xl font-bold mb-3">You&apos;re All Set!</h2>
              <p className="text-muted-foreground max-w-md mb-8">
                I have everything I need to build your personalized training plan.
                Let&apos;s get you to the finish line.
              </p>
              <div className="grid gap-3 w-full max-w-md">
                {completedSteps.map((step) => {
                  const stepInfo = ONBOARDING_STEPS.find((s) => s.id === step.step);
                  return (
                    <div
                      key={step.step}
                      className="flex items-center gap-3 p-3 border text-left"
                    >
                      <span className="text-xl">{stepInfo?.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{stepInfo?.title}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {step.skipped ? "Skipped" : step.data}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <Button size="lg" className="mt-8">
                Generate My Plan
              </Button>
            </div>
          ) : (
            /* Active onboarding */
            <div className="grid gap-6 md:grid-cols-[1fr_300px]">
              {/* Left: current interaction */}
              <div className="flex flex-col gap-6">
                {/* Voice indicator */}
                <VoiceSession
                  onStepUpdate={handleStepUpdate}
                  onComplete={handleComplete}
                  onTranscript={handleTranscript}
                />

                {/* Live transcript */}
                {transcript && (
                  <div className="p-4 border bg-muted/30">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                      You said
                    </p>
                    <p className="text-sm">{transcript}</p>
                  </div>
                )}

                {/* Current step info */}
                <div className="p-6 border">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">
                      {ONBOARDING_STEPS.find((s) => s.id === currentStep)?.icon}
                    </span>
                    <div>
                      <h3 className="font-semibold">
                        {ONBOARDING_STEPS.find((s) => s.id === currentStep)?.title}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {ONBOARDING_STEPS.find((s) => s.id === currentStep)?.description}
                      </p>
                    </div>
                  </div>
                  {ONBOARDING_STEPS.find((s) => s.id === currentStep)?.optional && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Say &quot;skip&quot; to move on
                    </p>
                  )}
                </div>
              </div>

              {/* Right: progress sidebar */}
              <aside className="hidden md:block">
                <h4 className="text-sm font-medium mb-3">Progress</h4>
                <div className="grid gap-2">
                  {ONBOARDING_STEPS.map((step) => (
                    <StepCard
                      key={step.id}
                      step={step}
                      isCurrent={step.id === currentStep}
                      data={completedSteps.find((s) => s.step === step.id)}
                    />
                  ))}
                </div>
              </aside>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
