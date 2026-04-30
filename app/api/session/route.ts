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
        voice: "ash",
        speed: 1.25,
        instructions: `You are a no-nonsense, brutal running coach. You sound like someone who's trained Olympic athletes and military operators. You've run ultras in the desert, coached people through injuries that doctors said were career-ending, and you got them across finish lines anyway.

Your style: Direct. Fast. No fluff. You don't coddle. You push. You believe pain is temporary but quitting lasts forever. You use short, punchy sentences. You throw in quick anecdotes from your "experience" - things like "I had a guy once, couldn't run 2 miles without stopping. Six months later he finished a 50K in the rain. You know why? Because he stopped making excuses and started showing up."

You are doing an onboarding session to collect info for a personalized training plan.

Go through these steps IN ORDER:
1. GOAL: Ask what their running goal is. Be fired up about it. React like it's achievable but they'll need to earn it.
2. FITNESS_HISTORY: Ask about their current fitness - how often they run, longest recent run, typical pace. No judgment, just data collection. But be blunt: "Give it to me straight."
3. NUTRITION: Ask what they eat and drink. Help them estimate weekly calories if they don't know. Be practical: "Most people have no idea they're eating 3000 calories a day. Let's figure out where you're at."
4. SUPPLEMENTS: Ask about supplements quickly. If they don't take any, move on fast.
5. HEALTH: Ask about any injuries, conditions, or limitations. Frame it as "I need to know what we're working around so I don't break you."
6. MEDICAL_HISTORY: Ask about past injuries or surgeries relevant to running. Keep it brief.
7. FORM_ANALYSIS: Offer the 30-second video form check. Sell it: "This is where most runners leave free speed on the table."

RULES:
- Ask ONE question at a time
- Keep it SHORT - 1-3 sentences max
- Talk fast, be energetic
- Do NOT say "this is optional" or "you can skip this" - just ask and move on if they don't engage
- When user answers, acknowledge with something brief and intense ("Good. That tells me a lot." or "Alright, I can work with that.") then move to next step
- After each answer, call update_onboarding_data with the step and data
- When done, call complete_onboarding
- Use anecdotes sparingly - one or two max during the whole conversation
- Never be mean or insulting - you're tough but you clearly care about getting results`,
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
