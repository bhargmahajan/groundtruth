import { latLngToCell } from 'h3-js';
import * as SunCalc from 'suncalc';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface IsochroneFeature {
  type: 'Feature';
  geometry: {
    type: 'Polygon';
    coordinates: number[][][];
  };
  properties: Record<string, unknown>;
}

/**
 * GeospatialEngine: Handles spatial indexing, pedestrian isochrone generation,
 * and microclimate/solar friction calculations.
 */
export class GeospatialEngine {
  private readonly orsApiKey: string;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('GeospatialEngine requires an OpenRouteService API key.');
    }
    this.orsApiKey = apiKey;
  }

  /**
   * Converts GPS coordinates into an Uber H3 Resolution 8 Hexagonal Index (~460m edge).
   */
  public getH3Index(coords: Coordinates): string {
    return latLngToCell(coords.latitude, coords.longitude, 8);
  }

  /**
   * Computes the Solar Zenith angle and heat friction factor.
   * If sun altitude is high (>60°), pedestrian walking speed is penalized by up to 35%.
   */
  public calculateHeatFrictionMultiplier(coords: Coordinates, date: Date = new Date()): number {
    const sunPosition = SunCalc.getPosition(date, coords.latitude, coords.longitude);
    const altitudeDegrees = sunPosition.altitude * (180 / Math.PI);

    // If sun altitude is above 45 degrees, walking speed decreases due to direct thermal load
    if (altitudeDegrees > 45) {
      const penalty = ((altitudeDegrees - 45) / 45) * 0.35; // Max 35% speed penalty
      return Number((1 + penalty).toFixed(2));
    }
    return 1.0;
  }

  /**
   * Fetches the base pedestrian walking isochrone from OpenRouteService.
   * Range is in seconds (e.g., 900 seconds = 15 minutes).
   */
  public async fetchWalkingIsochrone(coords: Coordinates, rangeSeconds: number = 900): Promise<IsochroneFeature> {
    const url = 'https://api.openrouteservice.org/v2/isochrones/foot-walking';
    const body = {
      locations: [[coords.longitude, coords.latitude]],
      range: [rangeSeconds],
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': this.orsApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`OpenRouteService Isochrone failed with status: ${response.status}`);
    }

    const data = await response.json();
    return data.features[0] as IsochroneFeature;
  }
}