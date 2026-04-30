import { NextRequest, NextResponse } from "next/server";
import { planLoopFromHome, planRoute, TravelMode } from "@/lib/google-maps";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const destination = url.searchParams.get("destination");
    const origin = url.searchParams.get("origin") ?? undefined;
    const mode = (url.searchParams.get("mode") as TravelMode | null) ?? "running";
    const distanceMeters = url.searchParams.get("distanceMeters");
    const bearing = url.searchParams.get("bearing");

    if (destination) {
      const route = await planRoute({ destination, origin, mode });
      return NextResponse.json({ route });
    }

    if (distanceMeters) {
      const route = await planLoopFromHome({
        targetDistanceMeters: Number(distanceMeters),
        bearingDegrees: bearing ? Number(bearing) : undefined,
      });
      return NextResponse.json({ route });
    }

    return NextResponse.json(
      { error: "Provide either ?destination=... or ?distanceMeters=... (with optional &bearing=)" },
      { status: 400 },
    );
  } catch (error) {
    console.error("Route plan error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to plan route" },
      { status: 500 },
    );
  }
}
