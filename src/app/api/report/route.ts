import { z } from "zod";
import type {
  AmenityCounts,
  NeighborhoodReport,
  ReportSource,
  WalkingRoute,
} from "@/lib/report-types";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  location: z.object({
    label: z.string().trim().min(1).max(200),
    lat: z.number().finite().min(-90).max(90),
    lng: z.number().finite().min(-180).max(180),
  }),
  radiusKm: z.number().finite().min(0.5).max(5),
});

interface OsmElement {
  type: string;
  id: number;
  tags?: Record<string, string>;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  geometry?: Array<{ lat: number; lon: number }>;
}

interface OverpassResponse {
  elements?: OsmElement[];
  osm3s?: { timestamp_osm_base?: string };
}

interface Feature {
  category: string;
  name: string;
  lat: number;
  lng: number;
  distanceFromCenter: number;
}

interface OverpassData {
  counts: AmenityCounts;
  features: Feature[];
  nearestRoad: { name: string; lat: number; lng: number; distanceFromCenter: number } | null;
  timestamp: string | null;
  roadQueryError: string | null;
}

interface WeatherData {
  current?: {
    time?: string;
    temperature_2m?: number;
    apparent_temperature?: number;
    precipitation?: number;
  };
  daily?: { precipitation_sum?: number[] };
}

interface AirQualityData {
  current?: {
    time?: string;
    us_aqi?: number;
    european_aqi?: number;
    pm2_5?: number;
  };
}

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

const OSM_URL = "https://www.openstreetmap.org/copyright";
const WEATHER_URL = "https://open-meteo.com/en/docs";
const AIR_QUALITY_URL = "https://open-meteo.com/en/docs/air-quality-api";
const ROUTING_URL = "https://openrouteservice.org/";

function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const radians = Math.PI / 180;
  const deltaLat = (b.lat - a.lat) * radians;
  const deltaLng = (b.lng - a.lng) * radians;
  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(a.lat * radians) * Math.cos(b.lat * radians) * Math.sin(deltaLng / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function getElementPoint(element: OsmElement) {
  if (typeof element.lat === "number" && typeof element.lon === "number") {
    return { lat: element.lat, lng: element.lon };
  }
  if (element.center) return { lat: element.center.lat, lng: element.center.lon };
  return null;
}

function nearestPointOnSegment(
  point: { lat: number; lng: number },
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
) {
  const meanLat = ((a.lat + b.lat + point.lat) / 3) * (Math.PI / 180);
  const scaleX = Math.cos(meanLat);
  const ax = a.lon * scaleX;
  const ay = a.lat;
  const bx = b.lon * scaleX;
  const by = b.lat;
  const px = point.lng * scaleX;
  const py = point.lat;
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const fraction =
    lengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared));

  return {
    lat: a.lat + fraction * (b.lat - a.lat),
    lng: a.lon + fraction * (b.lon - a.lon),
  };
}

function parseOverpass(
  data: OverpassResponse,
  center: { lat: number; lng: number },
  includeAmenities = true,
): OverpassData {
  const counts: AmenityCounts = {
    schools: 0,
    hospitals: 0,
    clinicsAndDoctors: 0,
    groceries: 0,
    markets: 0,
    chemists: 0,
    metroStations: 0,
    metroEntrances: 0,
    temples: 0,
    mosques: 0,
    churches: 0,
    otherPlacesOfWorship: 0,
    mappedWasteSites: 0,
    mappedDrainageFeatures: 0,
  };
  const counted = new Set<string>();
  const features: Feature[] = [];
  let nearestRoad: OverpassData["nearestRoad"] = null;

  for (const element of data.elements ?? []) {
    const tags = element.tags ?? {};
    if (!includeAmenities && !tags.highway) continue;
    const point = getElementPoint(element);
    const elementKey = `${element.type}/${element.id}`;
    const addCount = (key: keyof AmenityCounts) => {
      const uniqueKey = `${key}/${elementKey}`;
      if (!counted.has(uniqueKey)) {
        counted.add(uniqueKey);
        counts[key] += 1;
      }
    };
    const addFeature = (category: string, name: string) => {
      if (!point) return;
      features.push({
        category,
        name: name || category,
        ...point,
        distanceFromCenter: distanceMeters(center, point),
      });
    };

    if (tags.amenity === "school") {
      addCount("schools");
      addFeature("school", tags.name ?? "");
    }
    if (tags.amenity === "hospital") {
      addCount("hospitals");
      addFeature("healthcare", tags.name ?? "");
    } else if (["clinic", "doctors", "dentist"].includes(tags.amenity ?? "")) {
      addCount("clinicsAndDoctors");
      addFeature("healthcare", tags.name ?? "");
    }
    if (["supermarket", "convenience", "greengrocer", "grocery"].includes(tags.shop ?? "")) {
      addCount("groceries");
      addFeature("grocery", tags.name ?? "");
    }
    if (tags.amenity === "marketplace") {
      addCount("markets");
      addFeature("grocery", tags.name ?? "");
    }
    if (
      tags.amenity === "pharmacy" ||
      ["chemist", "pharmacy", "drugstore"].includes(tags.shop ?? "")
    ) {
      addCount("chemists");
      addFeature("chemist", tags.name ?? "");
    }

    const religion = tags.religion?.toLowerCase();
    if (tags.amenity === "church" || (tags.amenity === "place_of_worship" && religion === "christian")) {
      addCount("churches");
    } else if (tags.amenity === "mosque" || (tags.amenity === "place_of_worship" && religion === "muslim")) {
      addCount("mosques");
    } else if (
      tags.amenity === "temple" ||
      tags.building === "temple" ||
      (tags.amenity === "place_of_worship" && religion === "hindu")
    ) {
      addCount("temples");
    } else if (tags.amenity === "place_of_worship") {
      addCount("otherPlacesOfWorship");
    }

    if (
      tags.station === "subway" ||
      (tags.railway === "station" && tags.subway === "yes") ||
      (tags.public_transport === "station" && tags.subway === "yes")
    ) {
      addCount("metroStations");
      addFeature("metro station", tags.name ?? "");
    } else if (tags.railway === "subway_entrance") {
      addCount("metroEntrances");
      addFeature("metro station", tags.name ?? "Metro station entrance");
    }

    if (tags.landuse === "landfill" || ["waste_disposal", "recycling"].includes(tags.amenity ?? "")) {
      addCount("mappedWasteSites");
    }
    if (["drain", "ditch", "canal"].includes(tags.waterway ?? "")) {
      addCount("mappedDrainageFeatures");
    }

    if (
      tags.highway &&
      ["trunk", "primary", "secondary"].includes(tags.highway) &&
      element.geometry &&
      element.geometry.length > 0
    ) {
      let closestPoint: { lat: number; lng: number } | null = null;
      let closestDistance = Number.POSITIVE_INFINITY;
      for (let index = 1; index < element.geometry.length; index += 1) {
        const segmentPoint = nearestPointOnSegment(
          center,
          element.geometry[index - 1],
          element.geometry[index],
        );
        const segmentDistance = distanceMeters(center, segmentPoint);
        if (segmentDistance < closestDistance) {
          closestDistance = segmentDistance;
          closestPoint = segmentPoint;
        }
      }
      if (closestPoint && (!nearestRoad || closestDistance < nearestRoad.distanceFromCenter)) {
        nearestRoad = {
          name: tags.name ?? tags.ref ?? "Mapped main road",
          ...closestPoint,
          distanceFromCenter: closestDistance,
        };
      }
    }
  }

  return {
    counts,
    features,
    nearestRoad,
    timestamp: data.osm3s?.timestamp_osm_base ?? null,
    roadQueryError: null,
  };
}

async function fetchOverpassQuery(query: string): Promise<OverpassResponse> {
  let lastError = "OpenStreetMap query failed.";
  let timedOut = false;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "GroundTruth neighborhood report",
        },
        body: `data=${encodeURIComponent(query)}`,
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok) {
        lastError =
          response.status === 429 || response.status === 504 || response.status === 503
            ? `OpenStreetMap mirror returned HTTP ${response.status}; trying another mirror.`
            : `OpenStreetMap query returned HTTP ${response.status}.`;
        continue;
      }
      return (await response.json()) as OverpassResponse;
    } catch (error) {
      if (error instanceof Error && error.name === "TimeoutError") {
        timedOut = true;
        lastError = "OpenStreetMap query timed out; trying another mirror.";
      } else {
        lastError = "OpenStreetMap mirror is temporarily unavailable; trying another mirror.";
      }
    }
  }
  throw new Error(
    timedOut
      ? "All OpenStreetMap mirrors timed out or were unavailable. Try again later; map counts are unavailable, not zero."
      : lastError.replace(/; trying another mirror\.$/, "."),
  );
}

async function fetchOverpass(
  lat: number,
  lng: number,
  radiusMeters: number,
): Promise<OverpassData> {
  const placesQuery = `
    [out:json][timeout:8];
    (
      nwr["amenity"~"^(school|hospital|clinic|doctors|dentist|pharmacy|marketplace|place_of_worship|church|mosque|temple|waste_disposal|recycling)$"](around:${radiusMeters},${lat},${lng});
      nwr["shop"~"^(supermarket|convenience|greengrocer|grocery|chemist|pharmacy)$"](around:${radiusMeters},${lat},${lng});
      nwr["railway"~"^(station|subway_entrance)$"](around:${radiusMeters},${lat},${lng});
      nwr["station"="subway"](around:${radiusMeters},${lat},${lng});
      nwr["public_transport"="station"]["subway"="yes"](around:${radiusMeters},${lat},${lng});
      nwr["landuse"="landfill"](around:${radiusMeters},${lat},${lng});
      nwr["waterway"~"^(drain|ditch|canal)$"](around:${radiusMeters},${lat},${lng});
    )->.places;
    .places out center;
  `;
  const data = parseOverpass(
    await fetchOverpassQuery(placesQuery),
    { lat, lng },
  );

  const roadsQuery = `
    [out:json][timeout:4];
    way["highway"~"^(trunk|primary|secondary)$"](around:${radiusMeters},${lat},${lng});
    out geom;
  `;
  try {
    const roadData = await fetchOverpassQuery(roadsQuery);
    data.nearestRoad = parseOverpass(roadData, { lat, lng }, false).nearestRoad;
  } catch (error) {
    data.roadQueryError =
      error instanceof Error ? error.message : "Main road geometry is temporarily unavailable.";
  }
  return data;
}

async function fetchProvider<T>(url: string): Promise<{ data: T | null; error: string | null }> {
  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return { data: null, error: `Provider returned HTTP ${response.status}.` };
    return { data: (await response.json()) as T, error: null };
  } catch (error) {
    return {
      data: null,
      error:
        error instanceof Error && error.name === "TimeoutError"
          ? "Provider request timed out."
          : "Provider is temporarily unavailable.",
    };
  }
}

async function fetchWalkingRoutes(
  apiKey: string,
  center: { lat: number; lng: number },
  osm: OverpassData | null,
  radiusMeters: number,
): Promise<{ routes: WalkingRoute[]; mainRoad: WalkingRoute | null; error: string | null }> {
  if (!osm) return { routes: [], mainRoad: null, error: "Mapped destinations are unavailable." };

  const categories = ["school", "healthcare", "grocery", "chemist", "metro station"];
  const candidates = categories.flatMap((category) =>
    osm.features
      .filter((feature) => feature.category === category && feature.distanceFromCenter <= radiusMeters)
      .sort((a, b) => a.distanceFromCenter - b.distanceFromCenter)
      .slice(0, 3),
  );
  const road =
    osm.nearestRoad && osm.nearestRoad.distanceFromCenter <= radiusMeters
      ? osm.nearestRoad
      : null;
  const destinations = road ? [...candidates, { ...road, category: "main road" }] : candidates;
  if (!destinations.length) {
    return { routes: [], mainRoad: null, error: "No mapped walking destinations found in this radius." };
  }

  try {
    const response = await fetch("https://api.openrouteservice.org/v2/matrix/foot-walking", {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        locations: [
          [center.lng, center.lat],
          ...destinations.map((destination) => [destination.lng, destination.lat]),
        ],
        sources: [0],
        destinations: destinations.map((_, index) => index + 1),
        metrics: ["distance", "duration"],
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      return {
        routes: [],
        mainRoad: null,
        error: `Walking route service returned HTTP ${response.status}.`,
      };
    }
    const matrix = (await response.json()) as {
      distances?: Array<Array<number | null>>;
      durations?: Array<Array<number | null>>;
    };
    const routesByCategory = new Map<string, WalkingRoute>();
    let mainRoadRoute: WalkingRoute | null = null;

    destinations.forEach((destination, index) => {
      const distance = matrix.distances?.[0]?.[index];
      const duration = matrix.durations?.[0]?.[index];
      if (distance == null || duration == null || !Number.isFinite(distance) || !Number.isFinite(duration)) {
        return;
      }
      const route: WalkingRoute = {
        category: destination.category,
        name: destination.name,
        distanceKm: Math.round((distance / 1000) * 100) / 100,
        typicalMinutes: Math.round(duration / 60),
      };
      if (destination.category === "main road") {
        if (!mainRoadRoute || route.distanceKm < mainRoadRoute.distanceKm) mainRoadRoute = route;
      } else {
        const previous = routesByCategory.get(destination.category);
        if (!previous || route.distanceKm < previous.distanceKm) {
          routesByCategory.set(destination.category, route);
        }
      }
    });

    const routes = Array.from(routesByCategory.values());
    if (!routes.length && !mainRoadRoute) {
      return {
        routes: [],
        mainRoad: null,
        error: "The route service found no walkable paths to the mapped destinations.",
      };
    }
    return { routes, mainRoad: mainRoadRoute, error: null };
  } catch (error) {
    return {
      routes: [],
      mainRoad: null,
      error:
        error instanceof Error && error.name === "TimeoutError"
          ? "Walking route request timed out."
          : "Walking route service is temporarily unavailable.",
    };
  }
}

function score(value: number | null, basis: string) {
  return { value: value === null ? null : Math.max(0, Math.min(100, Math.round(value))), basis };
}

function makeScores(
  amenities: AmenityCounts | null,
  radiusKm: number,
  airQuality: NeighborhoodReport["airQuality"],
  walkingRoutes: WalkingRoute[],
) {
  const civicCategories: Array<{ count: number; targetPerSquareKm: number }> = amenities
    ? [
        { count: amenities.schools, targetPerSquareKm: 3 },
        { count: amenities.hospitals + amenities.clinicsAndDoctors, targetPerSquareKm: 2 },
        { count: amenities.groceries + amenities.markets, targetPerSquareKm: 4 },
        { count: amenities.chemists, targetPerSquareKm: 2 },
        { count: amenities.metroStations, targetPerSquareKm: 1 },
      ]
    : [];
  const civicScore =
    civicCategories.length > 0
      ? civicCategories.reduce(
          (sum, category) =>
            sum +
              Math.min(
                100,
                (category.count / (category.targetPerSquareKm * Math.PI * radiusKm ** 2)) * 100,
              ),
          0,
        ) / civicCategories.length
      : null;

  const environmentalScore =
    airQuality?.usAqi == null ? null : Math.max(0, 100 - (airQuality.usAqi / 500) * 100);
  const accessScores = walkingRoutes.map((route) => Math.max(0, 100 - route.distanceKm * 50));
  const walkAccessScore =
    accessScores.length > 0
      ? accessScores.reduce((sum, value) => sum + value, 0) / accessScores.length
      : null;
  const scoutComponents = [civicScore, environmentalScore, walkAccessScore].filter(
    (value): value is number => value !== null,
  );
  const scoutScore =
    scoutComponents.length >= 2
      ? scoutComponents.reduce((sum, value) => sum + value, 0) / scoutComponents.length
      : null;
  const metroRoute = walkingRoutes.find((route) => route.category === "metro station");
  const commuteScore = metroRoute ? Math.max(0, 100 - metroRoute.typicalMinutes * 3) : null;

  return {
    civicInfrastructure: score(
      civicScore,
      "Unofficial OpenStreetMap amenity-density proxy. Averages five categories against targets per km²: 3 schools, 2 health facilities, 4 grocery/market places, 2 chemists, and 1 metro station. Uses the selected circular radius. Not a quality rating.",
    ),
    environmental: score(
      environmentalScore,
      "Unofficial air-quality proxy: 100 × (1 − modeled US AQI / 500), clamped to 0–100. This is not a broader environmental or health assessment.",
    ),
    neighbourhoodScout: score(
      scoutScore,
      "Unofficial average of at least two available civic-density, current-air, and mapped walking-access proxy scores. Walking access averages up to five amenity-route scores (100 minus 50 points per route kilometre, clamped at zero). If fewer than two components are available, no composite is shown.",
    ),
    commuteReality: score(
      commuteScore,
      metroRoute
        ? "Walk-to-metro access proxy: 100 minus 3 points per OpenRouteService typical walking minute to the best routed of up to three geographically closest mapped stations. No commute destination or transit timetable was provided, so this is not a commute-time prediction."
        : "Unavailable: no mapped metro walking route could be calculated. A commute destination was not provided.",
    ),
  };
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Provide valid coordinates and a radius between 0.5 and 5 km." }, { status: 400 });
  }

  const { location, radiusKm } = parsed.data;
  const radiusMeters = Math.round(radiusKm * 1000);
  const latitude = location.lat.toFixed(6);
  const longitude = location.lng.toFixed(6);
  const [osmResult, weatherResult, airResult] = await Promise.all([
    fetchOverpass(location.lat, location.lng, radiusMeters)
      .then((data) => ({ data, error: null }))
      .catch((error: unknown) => ({
        data: null,
        error: error instanceof Error ? error.message : "OpenStreetMap is temporarily unavailable.",
      })),
    fetchProvider<WeatherData>(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,precipitation&daily=precipitation_sum&forecast_days=7&timezone=auto`,
    ),
    fetchProvider<AirQualityData>(
      `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${latitude}&longitude=${longitude}&current=us_aqi,european_aqi,pm2_5&timezone=auto`,
    ),
  ]);

  const osm = osmResult.data;
  const weatherData = weatherResult.data;
  const airData = airResult.data;
  const apiKey = process.env.ORS_API_KEY;
  const routeResult = apiKey
    ? await fetchWalkingRoutes(apiKey, location, osm, radiusMeters)
    : {
        routes: [],
        mainRoad: null,
        error: "Walking route service is not configured.",
      };

  const weather = weatherData
    ? {
        observedAt: weatherData.current?.time ?? null,
        temperatureC: weatherData.current?.temperature_2m ?? null,
        feelsLikeC: weatherData.current?.apparent_temperature ?? null,
        precipitationMm: weatherData.current?.precipitation ?? null,
        sevenDayRainfallMm: weatherData.daily?.precipitation_sum
          ? Math.round(
              weatherData.daily.precipitation_sum.reduce((sum, value) => sum + value, 0) * 10,
            ) / 10
          : null,
      }
    : null;
  const airQuality = airData
    ? {
        observedAt: airData.current?.time ?? null,
        usAqi: airData.current?.us_aqi ?? null,
        europeanAqi: airData.current?.european_aqi ?? null,
        pm25: airData.current?.pm2_5 ?? null,
      }
    : null;

  const sources: ReportSource[] = [
    {
      name: "OpenStreetMap / Overpass",
      url: OSM_URL,
      status: osm ? "available" : "unavailable",
      details: osm
        ? `Mapped features queried; OSM data timestamp: ${osm.timestamp ?? "not supplied"}. Counts are limited to tagged map features.${osm.roadQueryError ? ` Main-road geometry unavailable: ${osm.roadQueryError}` : ""}`
        : osmResult.error ?? "Map data unavailable.",
    },
    {
      name: "Open-Meteo weather",
      url: WEATHER_URL,
      status: weatherData ? "available" : "unavailable",
      details: weatherData ? "Current conditions and 7-day precipitation forecast." : weatherResult.error ?? "Weather unavailable.",
    },
    {
      name: "Open-Meteo air quality",
      url: AIR_QUALITY_URL,
      status: airData ? "available" : "unavailable",
      details: airData
        ? "Modeled current estimates, not ground-sensor readings. Air-quality data is attributed to CAMS ENSEMBLE (Copernicus Atmosphere Monitoring Service) via Open-Meteo."
        : airResult.error ?? "Air-quality data unavailable.",
    },
    {
      name: "openrouteservice walking routes",
      url: ROUTING_URL,
      status: !apiKey ? "not-configured" : routeResult.error ? "unavailable" : "available",
      details: !apiKey
        ? "Set ORS_API_KEY on the server to enable mapped walking routes."
        : routeResult.error ?? "Distances and typical durations use a mapped pedestrian network.",
    },
  ];

  const dataGaps = [
    "School quality is not measured by map listings; use official education inspection or outcome data.",
    "Crime statistics, water availability, and power-outage frequency require current local government or utility datasets not connected here.",
    "Future infrastructure plans require official planning documents; this report does not infer or invent them.",
    "A 7-day rainfall forecast is not monsoon or flood vulnerability. No authoritative flood-hazard dataset is connected.",
    "Mapped landfill, waste, and drainage tags do not establish an illegal/open dump or a sewage canal.",
    "Walking routes use mapped pedestrian paths and access tags; unrecorded construction, barriers, heat exposure, and other on-the-ground obstacles may be missing. Typical route duration is not weather-adjusted.",
    "A commute destination was not provided, so a real commute time cannot be calculated.",
    "Online shopping, ride-hailing, and food-delivery app coverage is not verified. Service varies by exact address, operating hours, and account; check the provider app or website.",
  ];

  const report: NeighborhoodReport = {
    generatedAt: new Date().toISOString(),
    location: { ...location, radiusKm },
    scores: makeScores(osm?.counts ?? null, radiusKm, airQuality, routeResult.routes),
    amenities: osm?.counts ?? null,
    weather,
    airQuality,
    walkingRoutes: routeResult.routes,
    nearestMainRoad: routeResult.mainRoad,
    digitalServices: [
      {
        category: "Online shopping",
        status: "not-verified",
        details:
          "Coverage and delivery availability depend on the exact address, selected products, and time. Verify in the provider app.",
      },
      {
        category: "Ride-hailing",
        status: "not-verified",
        details:
          "Pickup availability depends on the exact address, time, driver supply, and account. Verify in the provider app.",
      },
      {
        category: "Food ordering",
        status: "not-verified",
        details:
          "Restaurant delivery coverage depends on the exact address, time, and restaurant availability. Verify in the provider app.",
      },
    ],
    sources,
    dataGaps,
  };

  return Response.json({ report });
}
