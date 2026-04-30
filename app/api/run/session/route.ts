import { NextResponse } from "next/server";
import { USER_CONFIG } from "@/lib/user-config";

export async function POST() {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const r = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-realtime-preview-2024-12-17",
        voice: "ash",
        speed: 1.25,
        instructions: `You are the same brutal, no-nonsense running coach the user did onboarding with. They just finished a run and want feedback.

CONTEXT:
- Today's date: ${today}
- User home: ${USER_CONFIG.homeAddress}
- User timezone: ${USER_CONFIG.timezone}
- Apple Fitness has no server API. The user has the Apple Fitness app open on their phone.
- You will ask them to READ OUT what they see on screen. You capture it via the log_run tool and give honest, blunt feedback.

FLOW (one short question at a time):
1. Brief greeting. Tell them: "Open Apple Fitness, tap the workout you just finished. Let's debrief."
2. Total distance.
3. Total duration.
4. Average pace per km.
5. Average heart rate, then max heart rate (skip if not visible).
6. Active calories burned (skip if not visible).
7. Elevation gain (skip if not visible).
8. Ask how it FELT — perceived effort 1 to 10 — and any pain or notes.
9. As soon as you have enough, call log_run with the structured fields you collected and a feedback object containing summary, strengths (1-3 short bullets), and improvements (1-3 short bullets). OMIT any field the user did not provide — do not guess.
10. Then SPEAK the feedback to them out loud. Tough but constructive.
11. When you finish speaking, call finish_run_review.

RULES:
- Convert units yourself. "5K" -> distance_km=5. "30 minutes 12 seconds" -> duration_seconds=1812.
- Pace stays as a string like "5:30".
- Acknowledge each answer briefly ("Good." / "Got it.") before the next question.
- One question at a time. Short sentences. No coddling.
- Use only data the user actually said. Never invent splits, HR, or calories.
- Never claim Apple Fitness sent the data — the user is reading it to you.`,
        tools: [
          {
            type: "function",
            name: "log_run",
            description:
              "Log the run the user just described. Call this once you have enough metrics. OMIT any field the user did not provide — do not guess.",
            parameters: {
              type: "object",
              properties: {
                distance_km: {
                  type: "number",
                  description: "Total distance in kilometers",
                },
                duration_seconds: {
                  type: "number",
                  description: "Total duration in seconds",
                },
                avg_pace_per_km: {
                  type: "string",
                  description: "Average pace per km in 'M:SS' format, e.g. '5:30'",
                },
                avg_heart_rate: { type: "number" },
                max_heart_rate: { type: "number" },
                active_calories: { type: "number" },
                elevation_gain_m: {
                  type: "number",
                  description: "Elevation gain in meters",
                },
                perceived_effort: {
                  type: "number",
                  description: "User's RPE on a 1-10 scale",
                },
                notes: {
                  type: "string",
                  description: "Pain, conditions, or extra notes the user mentioned",
                },
                feedback: {
                  type: "object",
                  properties: {
                    summary: { type: "string" },
                    strengths: { type: "array", items: { type: "string" } },
                    improvements: { type: "array", items: { type: "string" } },
                  },
                  required: ["summary", "strengths", "improvements"],
                },
              },
              required: ["distance_km", "duration_seconds", "feedback"],
            },
          },
          {
            type: "function",
            name: "finish_run_review",
            description: "Call when the run review conversation is complete.",
            parameters: { type: "object", properties: {}, required: [] },
          },
        ],
        input_audio_transcription: { model: "gpt-4o-mini-transcribe" },
      }),
    });

    if (!r.ok) {
      const error = await r.text();
      console.error("OpenAI run-session error:", r.status, error);
      return NextResponse.json(
        { error: "Failed to create session", details: error },
        { status: r.status }
      );
    }

    const data = await r.json();
    return NextResponse.json({ clientSecret: data.client_secret.value });
  } catch (error) {
    console.error("Run session creation error:", error);
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }
}
