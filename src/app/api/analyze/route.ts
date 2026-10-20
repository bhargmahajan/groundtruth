import { NextResponse } from "next/server";
import { fetchCivicPOIs } from "@/lib/overpass";
import { getClimateData, computeWalkability } from "@/lib/climate";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { lat, lng, radiusKm } = body;

    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);
    const parsedRadius = Math.min(Math.max(parseFloat(radiusKm) || 1, 0.5), 10); // Clamp 500m to 10km

    const radiusMeters = Math.round(parsedRadius * 1000);

    const [amenities, climate] = await Promise.all([
      fetchCivicPOIs(parsedLat, parsedLng, radiusMeters),
      getClimateData(parsedLat, parsedLng),
    ]);

    const walkability = computeWalkability(parsedRadius, climate);

    // Composite scoring logic (Normalized out of 100)
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

    return NextResponse.json({
      status: "success",
      metrics: {
        civicInfrastructureScore,
        environmentalScore,
        commuteRealityScore,
        walkability,
        climate,
        amenityBreakdown: amenities,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { status: "error", message: "Failed to generate local evaluation. Please try again." },
      { status: 500 }
    );
  }
}