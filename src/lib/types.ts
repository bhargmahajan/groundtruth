// src/lib/types.ts
export interface AmenityCounts {
  schools: number;
  hospitals: number;
  chemistShops: number;
  groceryAndMarkets: number;
  metroStations: number;
  temples: number;
  mosques: number;
  churches: number;
  openDumps: number;
  sewageCanals: number;
  policeStations: number;
  powerSubstations: number;
  waterTowers: number;
  parks: number;
}

export interface NearestDistances {
  mainRoadMeters: number;
  nearestSchoolMeters: number | null;
  nearestHospitalMeters: number | null;
  nearestMarketMeters: number | null;
  nearestMetroMeters: number | null;
}

export interface WalkabilityItem {
  label: string;
  distanceMeters: number | null;
  walkingMinutes: number | null;
  effortLevel: "Easy" | "Moderate" | "Strenuous" | "Not in Range";
}

export interface GroundTruthReport {
  scores: {
    civicInfrastructureScore: number;
    environmentalScore: number;
    neighbourhoodScoutScore: number;
    commuteRealityScore: number;
  };
  amenities: AmenityCounts;
  climate: {
    temperature: number;
    feelsLike: number;
    humidity: number;
    precipitation: number;
    isMonsoonRisk: boolean;
    monsoonRiskLevel: "Low" | "Moderate" | "High (Waterlogging Risk)";
  };
  airQuality: {
    aqi: number;
    pm25: number;
    pm10: number;
    category: "Good" | "Moderate" | "Unhealthy for Sensitive" | "Unhealthy" | "Severe";
  };
  walkability: {
    effectiveSpeedKmH: number;
    impedanceSummary: string;
    obstaclePenaltyPercent: number;
    items: WalkabilityItem[];
  };
  qualitative: {
    schoolingQuality: { rating: string; detail: string };
    crimeStatistics: { rating: string; detail: string };
    waterAvailability: { rating: string; detail: string };
    powerOutageFrequency: { rating: string; detail: string };
    futureInfrastructurePlans: { rating: string; detail: string };
    wasteAndSewage: { rating: string; detail: string };
  };
}