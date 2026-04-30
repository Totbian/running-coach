import { google, calendar_v3 } from "googleapis";
import { USER_CONFIG } from "./user-config";

const SCOPES = ["https://www.googleapis.com/auth/calendar"];

let cachedClient: calendar_v3.Calendar | null = null;

function getCalendarClient(): calendar_v3.Calendar {
  if (cachedClient) return cachedClient;

  const rawJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const keyFile = process.env.GOOGLE_SERVICE_ACCOUNT_FILE;

  let credentials: Record<string, unknown> | undefined;
  if (rawJson) {
    credentials = JSON.parse(rawJson);
  }

  const auth = new google.auth.GoogleAuth({
    ...(credentials ? { credentials } : {}),
    ...(keyFile && !credentials ? { keyFile } : {}),
    scopes: SCOPES,
  });

  cachedClient = google.calendar({ version: "v3", auth });
  return cachedClient;
}

export interface RunEvent {
  id?: string;
  title: string;
  description?: string;
  start: Date;
  end: Date;
  location?: string;
}

export async function listUpcomingEvents(opts?: {
  calendarId?: string;
  maxResults?: number;
  timeMin?: Date;
  timeMax?: Date;
}): Promise<RunEvent[]> {
  const calendar = getCalendarClient();
  const res = await calendar.events.list({
    calendarId: opts?.calendarId ?? USER_CONFIG.calendarId,
    timeMin: (opts?.timeMin ?? new Date()).toISOString(),
    timeMax: opts?.timeMax?.toISOString(),
    maxResults: opts?.maxResults ?? 25,
    singleEvents: true,
    orderBy: "startTime",
  });

  const items = res.data.items ?? [];
  return items.map((e) => ({
    id: e.id ?? undefined,
    title: e.summary ?? "(untitled)",
    description: e.description ?? undefined,
    start: new Date(e.start?.dateTime ?? e.start?.date ?? Date.now()),
    end: new Date(e.end?.dateTime ?? e.end?.date ?? Date.now()),
    location: e.location ?? undefined,
  }));
}

export async function createRunEvent(event: RunEvent, calendarId?: string): Promise<RunEvent> {
  const calendar = getCalendarClient();
  const res = await calendar.events.insert({
    calendarId: calendarId ?? USER_CONFIG.calendarId,
    requestBody: {
      summary: event.title,
      description: event.description,
      location: event.location,
      start: {
        dateTime: event.start.toISOString(),
        timeZone: USER_CONFIG.timezone,
      },
      end: {
        dateTime: event.end.toISOString(),
        timeZone: USER_CONFIG.timezone,
      },
    },
  });

  return {
    id: res.data.id ?? undefined,
    title: res.data.summary ?? event.title,
    description: res.data.description ?? undefined,
    start: new Date(res.data.start?.dateTime ?? event.start),
    end: new Date(res.data.end?.dateTime ?? event.end),
    location: res.data.location ?? undefined,
  };
}

export async function updateRunEvent(
  eventId: string,
  patch: Partial<RunEvent>,
  calendarId?: string,
): Promise<RunEvent> {
  const calendar = getCalendarClient();
  const requestBody: calendar_v3.Schema$Event = {};
  if (patch.title !== undefined) requestBody.summary = patch.title;
  if (patch.description !== undefined) requestBody.description = patch.description;
  if (patch.location !== undefined) requestBody.location = patch.location;
  if (patch.start) {
    requestBody.start = {
      dateTime: patch.start.toISOString(),
      timeZone: USER_CONFIG.timezone,
    };
  }
  if (patch.end) {
    requestBody.end = {
      dateTime: patch.end.toISOString(),
      timeZone: USER_CONFIG.timezone,
    };
  }

  const res = await calendar.events.patch({
    calendarId: calendarId ?? USER_CONFIG.calendarId,
    eventId,
    requestBody,
  });

  return {
    id: res.data.id ?? undefined,
    title: res.data.summary ?? "",
    description: res.data.description ?? undefined,
    start: new Date(res.data.start?.dateTime ?? Date.now()),
    end: new Date(res.data.end?.dateTime ?? Date.now()),
    location: res.data.location ?? undefined,
  };
}

export async function deleteEvent(eventId: string, calendarId?: string): Promise<void> {
  const calendar = getCalendarClient();
  await calendar.events.delete({
    calendarId: calendarId ?? USER_CONFIG.calendarId,
    eventId,
  });
}

export async function findFreeSlots(opts: {
  startDate: Date;
  endDate: Date;
  durationMinutes: number;
  earliestHour?: number;
  latestHour?: number;
  calendarId?: string;
}): Promise<{ start: Date; end: Date }[]> {
  const calendar = getCalendarClient();
  const res = await calendar.freebusy.query({
    requestBody: {
      timeMin: opts.startDate.toISOString(),
      timeMax: opts.endDate.toISOString(),
      timeZone: USER_CONFIG.timezone,
      items: [{ id: opts.calendarId ?? USER_CONFIG.calendarId }],
    },
  });

  const calId = opts.calendarId ?? USER_CONFIG.calendarId;
  const busy = res.data.calendars?.[calId]?.busy ?? [];
  const earliestHour = opts.earliestHour ?? 6;
  const latestHour = opts.latestHour ?? 21;

  const slots: { start: Date; end: Date }[] = [];
  const cursor = new Date(opts.startDate);

  while (cursor < opts.endDate) {
    const dayStart = new Date(cursor);
    dayStart.setHours(earliestHour, 0, 0, 0);
    const dayEnd = new Date(cursor);
    dayEnd.setHours(latestHour, 0, 0, 0);

    let slotStart = dayStart > opts.startDate ? dayStart : new Date(opts.startDate);

    for (const block of busy) {
      const blockStart = new Date(block.start ?? "");
      const blockEnd = new Date(block.end ?? "");
      if (blockEnd <= slotStart || blockStart >= dayEnd) continue;
      if (blockStart > slotStart) {
        const candidateEnd = new Date(slotStart.getTime() + opts.durationMinutes * 60_000);
        if (candidateEnd <= blockStart && candidateEnd <= dayEnd) {
          slots.push({ start: new Date(slotStart), end: candidateEnd });
        }
      }
      if (blockEnd > slotStart) slotStart = blockEnd;
    }

    if (slotStart < dayEnd) {
      const candidateEnd = new Date(slotStart.getTime() + opts.durationMinutes * 60_000);
      if (candidateEnd <= dayEnd) {
        slots.push({ start: new Date(slotStart), end: candidateEnd });
      }
    }

    cursor.setDate(cursor.getDate() + 1);
    cursor.setHours(0, 0, 0, 0);
  }

  return slots;
}
