// src/app/api/analyze/route.ts
import { NextResponse } from "next/server";
import { fetchCivicPOIs } from "@/lib/overpass";
import { getClimateData, computeWalkability } from "@/lib/climate";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { lat, lng, radiusKm } = body;

    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);
    const parsedRadius = Math.min(Math.max(parseFloat(radiusKm) || 1, 0.5), 10);
    const radiusMeters = Math.round(parsedRadius * 1000);

    console.log(`\n================== [API /analyze] INCOMING REQUEST ==================`);
    console.log(`Target: ${parsedLat}, ${parsedLng} | Radius: ${parsedRadius} km (${radiusMeters}m)`);

    const [amenities, climate] = await Promise.all([
      fetchCivicPOIs(parsedLat, parsedLng, radiusMeters),
      getClimateData(parsedLat, parsedLng),
    ]);

    const walkability = computeWalkability(parsedRadius, climate);

    const civicInfrastructureScore = Math.min(
      100,
      Math.round(
        amenities.schools * 15 +
        amenities.hospitals * 20 +
        amenities.pharmacies * 10 +
        amenities.markets * 10 +
        amenities.metroStations * 25
      )
    );

    const environmentalScore = Math.max(
      10,
      Math.round(
        100 -
        amenities.openDumps * 30 -
        amenities.drainageCanals * 15 -
        (climate.feelsLike > 34 ? 15 : 0) -
        (climate.isMonsoonRisk ? 20 : 0)
      )
    );

    const commuteRealityScore = Math.max(
      15,
      Math.round(
        (amenities.metroStations > 0 ? 50 : 20) +
        (walkability.estimatedMinutes <= 15 ? 40 : 20) -
        (climate.precipitation > 0 ? 15 : 0)
      )
    );

    const reportMetrics = {
      civicInfrastructureScore,
      environmentalScore,
      commuteRealityScore,
      walkability,
      climate,
      amenityBreakdown: amenities,
    };

    console.log(`--- GENERATED REPORT ---`);
    console.log(JSON.stringify(reportMetrics, null, 2));
    console.log(`====================================================================\n`);

    return NextResponse.json({
      status: "success",
      metrics: reportMetrics,
    });
  } catch (error: any) {
    console.error("[API /analyze ERROR]:", error);
    return NextResponse.json(
      { status: "error", message: error?.message || "Failed to generate evaluation" },
      { status: 500 }
    );
  }
}