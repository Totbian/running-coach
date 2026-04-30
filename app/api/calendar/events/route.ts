import { NextRequest, NextResponse } from "next/server";
import { createRunEvent, listUpcomingEvents, updateRunEvent } from "@/lib/google-calendar";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const maxResults = Number(url.searchParams.get("max") ?? 25);
    const timeMin = url.searchParams.get("from")
      ? new Date(url.searchParams.get("from")!)
      : undefined;
    const timeMax = url.searchParams.get("to")
      ? new Date(url.searchParams.get("to")!)
      : undefined;

    const events = await listUpcomingEvents({ maxResults, timeMin, timeMax });
    return NextResponse.json({ events });
  } catch (error) {
    console.error("Calendar list error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list events" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, title, description, start, end, location } = body ?? {};
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    const event = await updateRunEvent(id, {
      title,
      description,
      location,
      start: start ? new Date(start) : undefined,
      end: end ? new Date(end) : undefined,
    });
    return NextResponse.json({ event });
  } catch (error) {
    console.error("Calendar update error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update event" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, description, start, end, location } = body ?? {};
    if (!title || !start || !end) {
      return NextResponse.json(
        { error: "title, start, and end are required" },
        { status: 400 },
      );
    }
    const event = await createRunEvent({
      title,
      description,
      location,
      start: new Date(start),
      end: new Date(end),
    });
    return NextResponse.json({ event });
  } catch (error) {
    console.error("Calendar create error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create event" },
      { status: 500 },
    );
  }
}
