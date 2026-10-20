const OVERPASS_MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

export async function fetchCivicPOIs(lat: number, lng: number, radiusMeters: number) {
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
    out center count;
  `;

  for (let attempt = 0; attempt < OVERPASS_MIRRORS.length; attempt++) {
    const endpoint = OVERPASS_MIRRORS[attempt];
    try {
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
        // Backoff delay before trying next mirror
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }

      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      return parseOverpassElements(data.elements || []);
    } catch {
      if (attempt === OVERPASS_MIRRORS.length - 1) {
        // Return empty baseline rather than throwing runtime error
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