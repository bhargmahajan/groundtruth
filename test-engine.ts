import { GeospatialEngine } from './src/lib/geospatial/GeospatialEngine';

const engine = new GeospatialEngine(process.env.ORS_API_KEY || '');
const h3Index = engine.getH3Index({ latitude: 12.9716, longitude: 77.5946 });
const friction = engine.calculateHeatFrictionMultiplier({ latitude: 12.9716, longitude: 77.5946 });

console.log('Generated H3 Index:', h3Index);
console.log('Heat Friction Factor:', friction);