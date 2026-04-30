"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { RunVoiceSession, RunPayload } from "./voice-session";

function formatDuration(seconds?: number): string | null {
  if (seconds == null) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

interface StatProps {
  label: string;
  value: string | number | null | undefined;
  unit?: string;
}

function Stat({ label, value, unit }: StatProps) {
  if (value == null || value === "") return null;
  return (
    <div className="border p-4">
      <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-semibold mt-1">
        {value}
        {unit && <span className="text-base text-muted-foreground ml-1">{unit}</span>}
      </p>
    </div>
  );
}

export default function RunPage() {
  const [started, setStarted] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [run, setRun] = useState<RunPayload | null>(null);
  const [done, setDone] = useState(false);

  const handleRunLogged = useCallback((payload: RunPayload) => {
    setRun(payload);
  }, []);

  const handleComplete = useCallback(() => {
    setDone(true);
  }, []);

  const handleTranscript = useCallback((text: string) => {
    setTranscript(text);
  }, []);

  return (
    <div className="min-h-svh bg-background flex flex-col">
      <header className="border-b px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-lg font-semibold">
            Running Coach
          </Link>
          <span className="text-sm text-muted-foreground">Post-run debrief</span>
        </div>
      </header>

      <main className="flex-1 px-6 py-8">
        <div className="max-w-4xl mx-auto">
          {!started ? (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
              <div className="text-6xl mb-6">🏁</div>
              <h2 className="text-3xl font-bold mb-3">Just Finished a Run?</h2>
              <p className="text-muted-foreground max-w-md mb-2">
                Open the Apple Fitness app on your phone and pull up your latest workout.
                The coach will ask you to read the numbers out loud, then break it down
                for you.
              </p>
              <p className="text-xs text-muted-foreground max-w-md mb-8">
                We can&apos;t pull from Apple Fitness automatically — its data lives on
                your iPhone. Reading it out is the fastest path.
              </p>
              <Button size="lg" onClick={() => setStarted(true)}>
                Start Debrief
              </Button>
              <p className="text-xs text-muted-foreground mt-4">
                Requires microphone access
              </p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-[1fr_320px]">
              <div className="flex flex-col gap-6">
                <RunVoiceSession
                  onRunLogged={handleRunLogged}
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

                {run?.feedback && (
                  <div className="p-6 border space-y-4">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                        Coach&apos;s Take
                      </p>
                      <p className="text-base">{run.feedback.summary}</p>
                    </div>
                    {run.feedback.strengths?.length > 0 && (
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wider mb-2 text-emerald-600">
                          Strengths
                        </p>
                        <ul className="space-y-1">
                          {run.feedback.strengths.map((s, i) => (
                            <li key={i} className="text-sm flex gap-2">
                              <span className="text-emerald-600">✓</span>
                              <span>{s}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {run.feedback.improvements?.length > 0 && (
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wider mb-2 text-amber-600">
                          Work On
                        </p>
                        <ul className="space-y-1">
                          {run.feedback.improvements.map((s, i) => (
                            <li key={i} className="text-sm flex gap-2">
                              <span className="text-amber-600">→</span>
                              <span>{s}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {done && (
                  <div className="p-6 border bg-emerald-50 dark:bg-emerald-950/20">
                    <p className="text-sm font-medium">Run logged. Recover well.</p>
                    <div className="mt-4 flex gap-3">
                      <Link href="/run">
                        <Button variant="outline" size="sm">
                          Log Another
                        </Button>
                      </Link>
                      <Link href="/">
                        <Button size="sm">Home</Button>
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              <aside className="hidden md:block">
                <h4 className="text-sm font-medium mb-3">Captured</h4>
                {run ? (
                  <div className="grid gap-2">
                    <Stat label="Distance" value={run.distance_km} unit="km" />
                    <Stat label="Duration" value={formatDuration(run.duration_seconds)} />
                    <Stat label="Avg Pace" value={run.avg_pace_per_km} unit="/km" />
                    <Stat label="Avg HR" value={run.avg_heart_rate} unit="bpm" />
                    <Stat label="Max HR" value={run.max_heart_rate} unit="bpm" />
                    <Stat label="Calories" value={run.active_calories} unit="kcal" />
                    <Stat label="Elevation" value={run.elevation_gain_m} unit="m" />
                    <Stat label="Effort" value={run.perceived_effort} unit="/10" />
                    {run.notes && (
                      <div className="border p-4">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                          Notes
                        </p>
                        <p className="text-sm">{run.notes}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Stats will appear here as the coach captures them.
                  </p>
                )}
              </aside>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
