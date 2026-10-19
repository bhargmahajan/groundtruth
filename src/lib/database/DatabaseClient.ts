import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * DatabaseClient: Handles PostGIS spatial queries, H3 cache checks, and report storage.
 */
export class DatabaseClient {
  private readonly supabase: SupabaseClient;

  constructor(url: string, serviceKey: string) {
    this.supabase = createClient(url, serviceKey);
  }

  /**
   * Checks if an H3 Hex Zone is already analyzed and cached.
   */
  public async getCachedHexZone(h3Index: string) {
    const { data, error } = await this.supabase
      .from('hex_zones')
      .select('*')
      .eq('h3_index', h3Index)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is code for 0 rows returned
      console.error('Error fetching hex zone cache:', error);
    }
    return data;
  }

  /**
   * Persists a calculated Hex Zone polygon into PostGIS.
   */
  public async saveHexZone(h3Index: string, lng: number, lat: number, isochroneGeoJson: object) {
    const pointWkt = `SRID=4326;POINT(${lng} ${lat})`;
    
    const { error } = await this.supabase.from('hex_zones').upsert({
      h3_index: h3Index,
      center_geom: pointWkt,
      ideal_isochrone: isochroneGeoJson,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.error('Failed to save hex zone cache:', error);
    }
  }
}