import { NextResponse } from 'next/server';
import { z } from 'zod';
import { GeospatialEngine } from '@/lib/geospatial/GeospatialEngine';
import { DatabaseClient } from '@/lib/database/DatabaseClient';
import { AIClaimExtractor } from '@/lib/nlp/AIClaimExtractor';

// Input validation schema using Zod
const AuditRequestSchema = z.object({
  address: z.string().min(5),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  rawListingText: z.string().optional().default(''),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const validatedData = AuditRequestSchema.parse(json);

    const geoEngine = new GeospatialEngine(process.env.ORS_API_KEY!);
    const dbClient = new DatabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const aiExtractor = new AIClaimExtractor(process.env.GEMINI_API_KEY!);

    // 1. Calculate H3 Index
    const h3Index = geoEngine.getH3Index({
      latitude: validatedData.latitude,
      longitude: validatedData.longitude,
    });

    // 2. Check Cache
    const cachedZone = await dbClient.getCachedHexZone(h3Index);
    if (cachedZone) {
      return NextResponse.json({
        source: 'CACHE',
        h3Index,
        isochrone: cachedZone.ideal_isochrone,
        message: 'Loaded instantly from PostGIS cache.',
      });
    }

    // 3. Cache Miss: Calculate live isochrone & parse claims
    const [isochrone, claims] = await Promise.all([
      geoEngine.fetchWalkingIsochrone({
        latitude: validatedData.latitude,
        longitude: validatedData.longitude,
      }),
      aiExtractor.extractClaims(validatedData.rawListingText),
    ]);

    // 4. Save to Cache in background
    await dbClient.saveHexZone(
      h3Index,
      validatedData.longitude,
      validatedData.latitude,
      isochrone.geometry
    );

    return NextResponse.json({
      source: 'LIVE_CALCULATION',
      h3Index,
      isochrone: isochrone.geometry,
      extractedClaims: claims,
      heatMultiplier: geoEngine.calculateHeatFrictionMultiplier({
        latitude: validatedData.latitude,
        longitude: validatedData.longitude,
      }),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input parameters', details: error.issues }, { status: 400 });
    }
    console.error('Audit API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}