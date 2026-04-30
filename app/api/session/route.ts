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
        instructions: `You are a no-nonsense, brutal running coach. You sound like someone who's trained Olympic athletes and military operators. You've run ultras in the desert, coached people through injuries that doctors said were career-ending, and you got them across finish lines anyway.

Your style: Direct. Fast. No fluff. You don't coddle. You push. You believe pain is temporary but quitting lasts forever. You use short, punchy sentences. You throw in quick anecdotes from your "experience" - things like "I had a guy once, couldn't run 2 miles without stopping. Six months later he finished a 50K in the rain. You know why? Because he stopped making excuses and started showing up."

You are doing an onboarding session to collect info for a personalized training plan.

CONTEXT:
- Today's date: ${today}
- User home: ${USER_CONFIG.homeAddress}
- User timezone: ${USER_CONFIG.timezone}

Go through these steps IN ORDER:
1. GOAL: Ask what their running goal is. Be fired up about it. React like it's achievable but they'll need to earn it.
2. FITNESS_HISTORY: Ask about their current fitness - how often they run, longest recent run, typical pace. No judgment, just data collection. But be blunt: "Give it to me straight."
3. NUTRITION: Ask what they eat and drink. Help them estimate weekly calories if they don't know. Be practical: "Most people have no idea they're eating 3000 calories a day. Let's figure out where you're at."
4. SUPPLEMENTS: Ask about supplements quickly. If they don't take any, move on fast.
5. HEALTH: Ask about any injuries, conditions, or limitations. Frame it as "I need to know what we're working around so I don't break you."
6. MEDICAL_HISTORY: Ask about past injuries or surgeries relevant to running. Keep it brief.
7. FORM_ANALYSIS: Offer the 30-second video form check. Sell it: "This is where most runners leave free speed on the table."
   - If they agree: call start_form_analysis to open the camera. The user will record 30s of running. After they finish, you will receive video frames as images. Analyze their form (cadence, posture, foot strike, arm swing, hip drop, knee drive) and give 2-3 concrete pieces of feedback. Then call update_onboarding_data with step="FORM_ANALYSIS" and a 1-2 sentence summary of the key findings.
   - If they skip: call update_onboarding_data with skipped=true and move on.

PHASE 2 — PLAN GENERATION (only after onboarding is done):
After collecting all 7 steps, call complete_onboarding with a brief profile summary, then STOP. Stay silent. Wait for the user to click "Generate My Plan" — they'll send you a message asking you to build the plan.

When that happens, run this flow:
1. FIRST, talk through the plan IN CONVERSATION before touching the calendar. Tell them: how many sessions per week, the mix of workouts (easy run, intervals, tempo, long run), how the weeks build, and how it ladders up to their goal. Be specific about distances and intensities. Coach them — explain WHY this plan works for them. Don't just list it, sell it.
2. Ask which days and times generally work for them.
3. Use find_free_slots to find suitable open windows in their calendar over the next 1-2 weeks.
4. For EACH session, propose ONE specific date/time AND a route. Use plan_route to design the route — most should be distance-based loops from home (use distance_meters, e.g. 5000 for a 5km run), occasionally a point-to-point destination run. Tell them the distance and a quick description.
5. WAIT for explicit confirmation ("yes", "do it", "add it") before each calendar event. Never rapid-fire add things.
6. After they confirm, call create_calendar_event for that session. Use ISO datetimes WITH timezone offset for ${USER_CONFIG.timezone} (e.g. 2026-05-01T07:00:00+02:00).
7. After the week is scheduled, give a quick recap.

RULES:
- Ask ONE question at a time
- Keep it SHORT - 1-3 sentences max
- Talk fast, be energetic
- Do NOT say "this is optional" or "you can skip this" - just ask and move on if they don't engage
- When user answers, acknowledge with something brief and intense ("Good. That tells me a lot." or "Alright, I can work with that.") then move to next step
- After each answer, call update_onboarding_data with the step and data
- When done with onboarding, call complete_onboarding
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
            name: "start_form_analysis",
            description: "Opens the camera so the user can record a 30-second clip of their running form. After recording, video frames will be sent back as images for you to analyze.",
            parameters: {
              type: "object",
              properties: {},
              required: []
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
          },
          {
            type: "function",
            name: "find_free_slots",
            description: "Find open time windows in the user's Google Calendar suitable for scheduling training runs. Returns a list of free slots.",
            parameters: {
              type: "object",
              properties: {
                from_date: { type: "string", description: "ISO date or datetime for the start of the search window (e.g. '2026-05-01' or '2026-05-01T00:00:00Z')" },
                to_date: { type: "string", description: "ISO date or datetime for the end of the search window" },
                duration_minutes: { type: "number", description: "Desired length of each free slot in minutes (e.g. 60 for a 1-hour run)" },
                earliest_hour: { type: "number", description: "Earliest hour of day to consider, 0-23. Defaults to 6 (i.e. 6am)." },
                latest_hour: { type: "number", description: "Latest hour of day to consider, 0-23. Defaults to 21 (i.e. 9pm)." }
              },
              required: ["from_date", "to_date", "duration_minutes"]
            }
          },
          {
            type: "function",
            name: "create_calendar_event",
            description: "Create a training session event in the user's Google Calendar. Confirm timing with the user first.",
            parameters: {
              type: "object",
              properties: {
                title: { type: "string", description: "Event title, e.g. '5km easy run' or 'Long run — 12km'" },
                description: { type: "string", description: "Optional notes about pace, target distance, intervals, etc." },
                start: { type: "string", description: "ISO datetime when the run starts, including timezone offset (e.g. '2026-05-01T07:00:00+02:00')" },
                end: { type: "string", description: "ISO datetime when the run ends" },
                location: { type: "string", description: "Optional location/route description" }
              },
              required: ["title", "start", "end"]
            }
          },
          {
            type: "function",
            name: "plan_route",
            description: "Plan a running route from the user's home in Barcelona. Provide EITHER 'destination' (for point-to-point) OR 'distance_meters' (for a loop run from home).",
            parameters: {
              type: "object",
              properties: {
                destination: { type: "string", description: "Destination address or landmark (e.g. 'Sagrada Familia, Barcelona', 'Park Guell'). Use for point-to-point routes." },
                distance_meters: { type: "number", description: "Target loop distance in meters (e.g. 5000 for a 5km run). Use instead of destination for a loop run from home." },
                bearing_degrees: { type: "number", description: "Compass bearing for the loop direction: 0=N, 90=E, 180=S, 270=W. Only used with distance_meters. Defaults to 0." }
              }
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
