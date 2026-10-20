export interface AmenityCounts {
  schools: number;
  hospitals: number;
  clinicsAndDoctors: number;
  groceries: number;
  markets: number;
  chemists: number;
  metroStations: number;
  metroEntrances: number;
  temples: number;
  mosques: number;
  churches: number;
  otherPlacesOfWorship: number;
  mappedWasteSites: number;
  mappedDrainageFeatures: number;
}

export interface ScoreMetric {
  value: number | null;
  basis: string;
}

export interface WalkingRoute {
  category: string;
  name: string;
  distanceKm: number;
  typicalMinutes: number;
}

export interface ReportSource {
  name: string;
  url: string;
  status: "available" | "unavailable" | "not-configured";
  details: string;
}

export interface DigitalServiceAvailability {
  category: string;
  status: "not-verified";
  details: string;
}

export interface NeighborhoodReport {
  generatedAt: string;
  location: {
    label: string;
    lat: number;
    lng: number;
    radiusKm: number;
  };
  scores: {
    civicInfrastructure: ScoreMetric;
    environmental: ScoreMetric;
    neighbourhoodScout: ScoreMetric;
    commuteReality: ScoreMetric;
  };
  amenities: AmenityCounts | null;
  weather: {
    observedAt: string | null;
    temperatureC: number | null;
    feelsLikeC: number | null;
    precipitationMm: number | null;
    sevenDayRainfallMm: number | null;
  } | null;
  airQuality: {
    observedAt: string | null;
    usAqi: number | null;
    europeanAqi: number | null;
    pm25: number | null;
  } | null;
  walkingRoutes: WalkingRoute[];
  nearestMainRoad: WalkingRoute | null;
  digitalServices: DigitalServiceAvailability[];
  sources: ReportSource[];
  dataGaps: string[];
}
