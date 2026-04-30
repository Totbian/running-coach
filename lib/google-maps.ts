import { USER_CONFIG } from "./user-config";

const DIRECTIONS_BASE = "https://maps.googleapis.com/maps/api/directions/json";

export type TravelMode = "walking" | "running" | "bicycling" | "driving";

export interface RouteStep {
  instruction: string;
  distanceMeters: number;
  durationSeconds: number;
}

export interface PlannedRoute {
  origin: string;
  destination: string;
  distanceMeters: number;
  distanceText: string;
  durationSeconds: number;
  durationText: string;
  polyline: string;
  steps: RouteStep[];
  warnings: string[];
  mapsUrl: string;
}

function buildMapsUrl(origin: string, destination: string, mode: TravelMode): string {
  const apiMode = mode === "running" ? "walking" : mode;
  const params = new URLSearchParams({
    api: "1",
    origin,
    destination,
    travelmode: apiMode,
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

interface DirectionsLeg {
  distance: { value: number; text: string };
  duration: { value: number; text: string };
  steps: Array<{
    html_instructions: string;
    distance: { value: number; text: string };
    duration: { value: number; text: string };
  }>;
}

interface DirectionsRoute {
  legs: DirectionsLeg[];
  overview_polyline: { points: string };
  warnings: string[];
}

interface DirectionsResponse {
  status: string;
  error_message?: string;
  routes: DirectionsRoute[];
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

export async function planRoute(opts: {
  destination: string;
  origin?: string;
  mode?: TravelMode;
  waypoints?: string[];
  alternatives?: boolean;
}): Promise<PlannedRoute> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_MAPS_API_KEY is not set");
  }

  // The Directions API has no native "running" mode; map it to walking.
  const apiMode = opts.mode === "running" ? "walking" : opts.mode ?? "walking";

  const params = new URLSearchParams({
    origin: opts.origin ?? USER_CONFIG.homeAddress,
    destination: opts.destination,
    mode: apiMode,
    key: apiKey,
  });

  if (opts.waypoints?.length) {
    params.set("waypoints", opts.waypoints.join("|"));
  }
  if (opts.alternatives) {
    params.set("alternatives", "true");
  }

  const res = await fetch(`${DIRECTIONS_BASE}?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`Directions API HTTP ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as DirectionsResponse;
  if (data.status !== "OK") {
    throw new Error(`Directions API ${data.status}: ${data.error_message ?? "no message"}`);
  }

  const route = data.routes[0];
  const leg = route.legs[0];
  const origin = opts.origin ?? USER_CONFIG.homeAddress;
  return {
    origin,
    destination: opts.destination,
    distanceMeters: leg.distance.value,
    distanceText: leg.distance.text,
    durationSeconds: leg.duration.value,
    durationText: leg.duration.text,
    polyline: route.overview_polyline.points,
    steps: leg.steps.map((s) => ({
      instruction: stripHtml(s.html_instructions),
      distanceMeters: s.distance.value,
      durationSeconds: s.duration.value,
    })),
    warnings: route.warnings ?? [],
    mapsUrl: buildMapsUrl(origin, opts.destination, opts.mode ?? "walking"),
  };
}

export async function planLoopFromHome(opts: {
  targetDistanceMeters: number;
  bearingDegrees?: number;
}): Promise<PlannedRoute> {
  // Pick a turnaround point ~half the target distance from home along a bearing.
  // We don't have a geocoding step here, so caller can pass any landmark via planRoute instead.
  // This helper estimates a destination by offsetting lat/lng — works for an MVP turnaround run.
  const halfKm = opts.targetDistanceMeters / 2 / 1000;
  const bearing = ((opts.bearingDegrees ?? 0) * Math.PI) / 180;

  // Hardcoded approximate Barcelona home coordinates (Carrer de Viladomat 96).
  const homeLat = 41.3795;
  const homeLng = 2.1547;

  const earthRadiusKm = 6371;
  const angularDistance = halfKm / earthRadiusKm;
  const lat1 = (homeLat * Math.PI) / 180;
  const lng1 = (homeLng * Math.PI) / 180;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDistance) +
      Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearing),
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat1),
      Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2),
    );

  const destLat = (lat2 * 180) / Math.PI;
  const destLng = (lng2 * 180) / Math.PI;
  return planRoute({
    destination: `${destLat},${destLng}`,
    mode: "walking",
  });
}
