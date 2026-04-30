import { NextRequest, NextResponse } from "next/server";
import { findFreeSlots } from "@/lib/google-calendar";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const start = url.searchParams.get("from");
    const end = url.searchParams.get("to");
    const duration = Number(url.searchParams.get("durationMinutes") ?? 60);
    const earliestHour = url.searchParams.get("earliestHour")
      ? Number(url.searchParams.get("earliestHour"))
      : undefined;
    const latestHour = url.searchParams.get("latestHour")
      ? Number(url.searchParams.get("latestHour"))
      : undefined;

    if (!start || !end) {
      return NextResponse.json(
        { error: "from and to query params are required (ISO dates)" },
        { status: 400 },
      );
    }

    const slots = await findFreeSlots({
      startDate: new Date(start),
      endDate: new Date(end),
      durationMinutes: duration,
      earliestHour,
      latestHour,
    });
    return NextResponse.json({ slots });
  } catch (error) {
    console.error("Free slots error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to find free slots" },
      { status: 500 },
    );
  }
}
