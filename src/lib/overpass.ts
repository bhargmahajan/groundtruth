// src/lib/overpass.ts
const OVERPASS_MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

export async function fetchCivicPOIs(lat: number, lng: number, radiusMeters: number) {
  // Use 'out tags center;' so tags (amenity, waterway, etc.) are included in the output
  const query = `
    [out:json][timeout:25];
    (
      nwr["amenity"~"school|hospital|clinic|pharmacy|marketplace"](around:${radiusMeters},${lat},${lng});
      nwr["amenity"~"place_of_worship"](around:${radiusMeters},${lat},${lng});
      nwr["railway"="subway_entrance"](around:${radiusMeters},${lat},${lng});
      nwr["station"="subway"](around:${radiusMeters},${lat},${lng});
      nwr["landuse"="landfill"](around:${radiusMeters},${lat},${lng});
      nwr["waterway"~"drain|ditch|canal"](around:${radiusMeters},${lat},${lng});
    );
    out tags center;
  `;

  for (let attempt = 0; attempt < OVERPASS_MIRRORS.length; attempt++) {
    const endpoint = OVERPASS_MIRRORS[attempt];
    try {
      console.log(`[Overpass] Fetching from ${endpoint} (Attempt ${attempt + 1})...`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.status === 429) {
        console.warn(`[Overpass] 429 Rate limited on ${endpoint}. Retrying next mirror...`);
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }

      if (!res.ok) {
        console.warn(`[Overpass] Failed with status ${res.status} on ${endpoint}`);
        continue;
      }

      const data = await res.json();
      console.log(`[Overpass] Raw elements retrieved: ${data.elements?.length ?? 0}`);
      return parseOverpassElements(data.elements || []);
    } catch (err: any) {
      console.error(`[Overpass] Error on ${endpoint}:`, err?.message || err);
      if (attempt === OVERPASS_MIRRORS.length - 1) {
        return getFallbackCivicCounts();
      }
    }
  }

  return getFallbackCivicCounts();
}

function parseOverpassElements(elements: any[]) {
  const counts = {
    schools: 0,
    hospitals: 0,
    pharmacies: 0,
    markets: 0,
    metroStations: 0,
    temples: 0,
    mosques: 0,
    churches: 0,
    openDumps: 0,
    drainageCanals: 0,
  };

  elements.forEach((el) => {
    const tags = el.tags || {};
    if (tags.amenity === "school") counts.schools++;
    if (tags.amenity === "hospital" || tags.amenity === "clinic") counts.hospitals++;
    if (tags.amenity === "pharmacy") counts.pharmacies++;
    if (tags.amenity === "marketplace") counts.markets++;
    if (tags.railway === "subway_entrance" || tags.station === "subway") counts.metroStations++;
    if (tags.amenity === "place_of_worship") {
      if (tags.religion === "hindu") counts.temples++;
      else if (tags.religion === "muslim") counts.mosques++;
      else if (tags.religion === "christian") counts.churches++;
    }
    if (tags.landuse === "landfill") counts.openDumps++;
    if (["drain", "ditch", "canal"].includes(tags.waterway)) counts.drainageCanals++;
  });

  return counts;
}

function getFallbackCivicCounts() {
  return {
    schools: 0,
    hospitals: 0,
    pharmacies: 0,
    markets: 0,
    metroStations: 0,
    temples: 0,
    mosques: 0,
    churches: 0,
    openDumps: 0,
    drainageCanals: 0,
  };
}