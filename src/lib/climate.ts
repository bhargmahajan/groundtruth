export async function getClimateData(lat: number, lng: number) {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code&daily=precipitation_sum&timezone=auto`;
    const res = await fetch(url, { next: { revalidate: 1800 } }); // 30 min cache
    if (!res.ok) throw new Error();
    const json = await res.json();

    return {
      temperature: json.current?.temperature_2m ?? 27,
      feelsLike: json.current?.apparent_temperature ?? 29,
      precipitation: json.current?.precipitation ?? 0,
      isMonsoonRisk: (json.daily?.precipitation_sum?.[0] ?? 0) > 15,
    };
  } catch {
    return { temperature: 26, feelsLike: 27, precipitation: 0, isMonsoonRisk: false };
  }
}

export function computeWalkability(
  distanceKm: number,
  climate: { temperature: number; feelsLike: number; precipitation: number }
) {
  // Base walking speed: 4.8 km/h => 12.5 mins per km
  let speedKmH = 4.8;

  // Temperature penalty
  if (climate.feelsLike > 35) speedKmH *= 0.75; // Heat slows pace by 25%
  else if (climate.feelsLike > 30) speedKmH *= 0.9;

  // Rain penalty
  if (climate.precipitation > 2) speedKmH *= 0.6; // Heavy rain slows significantly

  const walkingMinutes = Math.round((distanceKm / speedKmH) * 60);
  return {
    estimatedMinutes: walkingMinutes,
    comfortRating: speedKmH > 4 ? "Comfortable" : speedKmH > 3 ? "Strenuous (Heat/Obstacles)" : "Severe Climate Drag",
  };
}