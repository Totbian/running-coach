import { NextResponse } from "next/server";

export async function POST() {
  try {
    const r = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-realtime-preview-2024-12-17",
        voice: "sage",
        instructions: `You are a friendly, encouraging running coach AI doing an onboarding session. 
You are collecting information step by step to build a personalized training plan.

Your personality: warm, concise, motivating. Like a coach who genuinely cares but doesn't waste time.

You will go through these steps IN ORDER:
1. GOAL: Ask what their running goal is (e.g. "run a half marathon under 2 hours", "complete my first 5K", "improve my 10K time")
2. FITNESS_HISTORY: Ask them to describe their current fitness level and recent running history (how often they run, longest recent run, typical pace).
3. NUTRITION: Help them understand their calorie intake. Ask about foods/drinks they like, eating habits. Help estimate weekly calorie intake since most people don't know this. Give examples like "a typical lunch might be 600-800 calories".
4. SUPPLEMENTS: Ask if they take any supplements (protein, creatine, vitamins, etc). Tell them this is optional and they can skip it.
5. HEALTH: Ask about any health conditions, injuries, pregnancy, or physical limitations. Tell them this is optional but helps you plan safely.
6. MEDICAL_HISTORY: Ask about past injuries, surgeries, or chronic conditions relevant to running. Optional and skippable.
7. FORM_ANALYSIS: Offer optional 30-second video recording of their running form for gait analysis. They can skip this.

RULES:
- Ask ONE question at a time
- Keep responses SHORT (1-3 sentences max)
- When user answers, acknowledge briefly then move to next step
- If user says "skip" or "next", move on immediately
- After each answer, call update_onboarding_data with the step name and collected data
- When all steps are done, call complete_onboarding`,
        tools: [
          {
            type: "function",
            name: "update_onboarding_data",
            description: "Updates the onboarding UI with collected data from the current step",
            parameters: {
              type: "object",
              properties: {
                step: {
                  type: "string",
                  enum: ["GOAL", "FITNESS_HISTORY", "NUTRITION", "SUPPLEMENTS", "HEALTH", "MEDICAL_HISTORY", "FORM_ANALYSIS"],
                  description: "The current onboarding step being completed"
                },
                data: {
                  type: "string",
                  description: "Summary of what the user provided for this step"
                },
                skipped: {
                  type: "boolean",
                  description: "Whether the user skipped this step"
                }
              },
              required: ["step", "data", "skipped"]
            }
          },
          {
            type: "function",
            name: "complete_onboarding",
            description: "Called when all onboarding steps are complete",
            parameters: {
              type: "object",
              properties: {
                summary: {
                  type: "string",
                  description: "Brief summary of the user's profile"
                }
              },
              required: ["summary"]
            }
          }
        ],
        input_audio_transcription: {
          model: "gpt-4o-mini-transcribe"
        }
      }),
    });

    if (!r.ok) {
      const error = await r.text();
      console.error("OpenAI session error:", r.status, error);
      return NextResponse.json(
        { error: "Failed to create session", details: error },
        { status: r.status }
      );
    }

    const data = await r.json();
    return NextResponse.json({
      clientSecret: data.client_secret.value,
    });
  } catch (error) {
    console.error("Session creation error:", error);
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 500 }
    );
  }
}
