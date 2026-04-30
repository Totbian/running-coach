"use client";

import { useState, useCallback, useRef } from "react";
import Link from "next/link";
import { ONBOARDING_STEPS, StepData, StepId } from "@/lib/onboarding-steps";
import { VoiceSession, type VoiceSessionHandle } from "./voice-session";
import { StepCard } from "./step-card";
import { Button } from "@/components/ui/button";

export default function OnboardingPage() {
  const [isConnected, setIsConnected] = useState(false);
  const [currentStep, setCurrentStep] = useState<StepId>("GOAL");
  const [completedSteps, setCompletedSteps] = useState<StepData[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [transcript, setTranscript] = useState<string>("");
  const [planRequested, setPlanRequested] = useState(false);
  const voiceRef = useRef<VoiceSessionHandle>(null);

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

  const handleGeneratePlan = useCallback(() => {
    if (planRequested) return;
    setPlanRequested(true);

    const recap = completedSteps
      .map((s) => {
        const info = ONBOARDING_STEPS.find((x) => x.id === s.step);
        const label = info?.title ?? s.step;
        return `- ${label}: ${s.skipped ? "(skipped)" : s.data}`;
      })
      .join("\n");

    const message = `OK, I just clicked "Generate My Plan". Here's a recap of what I told you during onboarding:
${recap}

Now build my training plan. Important — talk it through with me before touching my calendar:

1. First, walk me through the plan in CONVERSATION. Tell me how many sessions per week, the mix of workouts (easy run, intervals, tempo, long run), how the weeks build, and how it ties to my goal. Be specific about durations and intensities. Coach me — explain WHY this plan works for me.
2. Then ask which days and what times generally work for me.
3. Use find_free_slots to find suitable open windows in my calendar over the next 1-2 weeks.
4. For each session, propose a specific date/time AND a route. Use plan_route to design it — most should be distance-based loops from home, occasionally a destination run. Tell me distance and a quick route description.
5. Wait for me to say yes before each calendar event. Don't rapid-fire add things.
6. After I confirm, call create_calendar_event for that session. Use ISO datetimes in Europe/Madrid (e.g. 2026-05-02T07:00:00+02:00).
7. After the week is scheduled, give me a quick recap.

Let's go.`;

    voiceRef.current?.injectUserMessage(message);
  }, [planRequested, completedSteps]);

  return (
    <div className="min-h-svh bg-background flex flex-col">
      <header className="border-b px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-lg font-semibold">Running Coach</h1>
          <span className="text-sm text-muted-foreground">
            {isComplete
              ? "All steps complete"
              : `Step ${ONBOARDING_STEPS.findIndex((s) => s.id === currentStep) + 1} of ${ONBOARDING_STEPS.length}`}
          </span>
        </div>
      </header>

      <main className="flex-1 px-6 py-8">
        <div className="max-w-4xl mx-auto">
          {!isConnected ? (
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
          ) : (
            /* Active onboarding + plan generation share the same shell so the
               WebRTC voice session stays mounted across the transition. */
            <div className="grid gap-6 md:grid-cols-[1fr_300px]">
              <div className="flex flex-col gap-6">
                <VoiceSession
                  ref={voiceRef}
                  onStepUpdate={handleStepUpdate}
                  onComplete={handleComplete}
                  onTranscript={handleTranscript}
                />

                {transcript && (
                  <div className="p-4 border bg-muted/30">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                      You said
                    </p>
                    <p className="text-sm">{transcript}</p>
                  </div>
                )}

                {!isComplete ? (
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
                ) : (
                  <div className="p-6 border flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">✅</span>
                      <div>
                        <h3 className="font-semibold">You&apos;re all set</h3>
                        <p className="text-sm text-muted-foreground">
                          {planRequested
                            ? "Your coach is walking through the plan — listen up."
                            : "Ready to build your training plan."}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Button
                        size="lg"
                        onClick={handleGeneratePlan}
                        disabled={planRequested}
                      >
                        {planRequested ? "Coach is planning..." : "Generate My Plan"}
                      </Button>
                      <Link href="/run">
                        <Button size="lg" variant="outline">
                          Log Today&apos;s Run
                        </Button>
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              <aside className="hidden md:block">
                <h4 className="text-sm font-medium mb-3">Progress</h4>
                <div className="grid gap-2">
                  {ONBOARDING_STEPS.map((step) => (
                    <StepCard
                      key={step.id}
                      step={step}
                      isCurrent={step.id === currentStep && !isComplete}
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
