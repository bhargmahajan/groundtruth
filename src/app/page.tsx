'use client';

import React, { useState, useEffect, useRef } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';

export default function GroundTruthDashboard() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const marker = useRef<any>(null);

  const [coords, setCoords] = useState<{ lat: number; lng: number }>({
    lat: 12.9716,
    lng: 77.5946,
  });

  const [address, setAddress] = useState<string>('Detecting location...');
  const [listingText, setListingText] = useState<string>(
    'Spacious 3BHK just 5 mins walk to Metro station.'
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [locating, setLocating] = useState<boolean>(true);
  const [auditResult, setAuditResult] = useState<any>(null);

  /**
   * Reverse-geocodes coordinates into a readable address using Nominatim
   */
  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
      );
      const data = await res.json();
      if (data && data.display_name) {
        setAddress(data.display_name);
      }
    } catch {
      setAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    }
  };

  useEffect(() => {
    let isMounted = true;

    // Dynamically import standard maplibre-gl
    import('maplibre-gl').then((maplibreglModule: any) => {
      if (!isMounted || !mapContainer.current || map.current) return;

      const maplibregl = maplibreglModule.default || maplibreglModule;

      // Fix "Worker failed to load": Use an inline Blob Worker
      // This loads the worker completely from browser memory and never requests a .js file over the network
      try {
        if (maplibregl.workerUrl !== undefined) {
          const workerBlob = new Blob(
            ['self.onmessage = function() {};'],
            { type: 'application/javascript' }
          );
          maplibregl.workerUrl = URL.createObjectURL(workerBlob);
        }
      } catch {
        // Fallback for environments where workerUrl configuration differs
      }

      // OpenStreetMap Raster Style (Requires zero vector worker decoding)
      const rasterStyle: any = {
        version: 8,
        sources: {
          'osm-tiles': {
            type: 'raster',
            tiles: [
              'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
              'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
              'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
            ],
            tileSize: 256,
            attribution: '&copy; OpenStreetMap Contributors',
          },
        },
        layers: [
          {
            id: 'osm-tiles-layer',
            type: 'raster',
            source: 'osm-tiles',
            minzoom: 0,
            maxzoom: 19,
          },
        ],
      };

      map.current = new maplibregl.Map({
        container: mapContainer.current,
        style: rasterStyle,
        center: [coords.lng, coords.lat],
        zoom: 14,
      });

      // Draggable Location Marker
      marker.current = new maplibregl.Marker({
        draggable: true,
        color: '#10b981',
      })
        .setLngLat([coords.lng, coords.lat])
        .addTo(map.current);

      marker.current.on('dragend', () => {
        const lngLat = marker.current.getLngLat();
        setCoords({ lat: lngLat.lat, lng: lngLat.lng });
        reverseGeocode(lngLat.lat, lngLat.lng);
      });

      map.current.on('click', (e: any) => {
        const { lng, lat } = e.lngLat;
        marker.current.setLngLat([lng, lat]);
        setCoords({ lat, lng });
        reverseGeocode(lat, lng);
      });

      // HTML5 Geolocation with fallback
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            if (!isMounted) return;
            const userLat = position.coords.latitude;
            const userLng = position.coords.longitude;

            setCoords({ lat: userLat, lng: userLng });
            setLocating(false);

            if (map.current) {
              map.current.flyTo({ center: [userLng, userLat], zoom: 15 });
            }
            if (marker.current) {
              marker.current.setLngLat([userLng, userLat]);
            }
            reverseGeocode(userLat, userLng);
          },
          () => {
            setLocating(false);
            reverseGeocode(coords.lat, coords.lng);
          },
          { enableHighAccuracy: true, timeout: 6000 }
        );
      } else {
        setLocating(false);
        reverseGeocode(coords.lat, coords.lng);
      }
    });

    return () => {
      isMounted = false;
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  const handleAddressSearch = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && address.trim()) {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            address
          )}`
        );
        const data = await res.json();
        if (data && data.length > 0) {
          const newLat = parseFloat(data[0].lat);
          const newLng = parseFloat(data[0].lon);

          setCoords({ lat: newLat, lng: newLng });
          if (map.current) {
            map.current.flyTo({ center: [newLng, newLat], zoom: 15 });
          }
          if (marker.current) {
            marker.current.setLngLat([newLng, newLat]);
          }
        }
      } catch (err) {
        console.error('Search forward geocoding failed:', err);
      }
    }
  };

  const runAudit = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/audit/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address,
          latitude: coords.lat,
          longitude: coords.lng,
          rawListingText: listingText,
        }),
      });

      const data = await res.json();
      setAuditResult(data);

      if (map.current && data.isochrone) {
        if (map.current.getLayer('isochrone-line')) {
          map.current.removeLayer('isochrone-line');
        }
        if (map.current.getLayer('isochrone-layer')) {
          map.current.removeLayer('isochrone-layer');
        }
        if (map.current.getSource('isochrone-source')) {
          map.current.removeSource('isochrone-source');
        }

        map.current.addSource('isochrone-source', {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: data.isochrone,
            properties: {},
          },
        });

        map.current.addLayer({
          id: 'isochrone-layer',
          type: 'fill',
          source: 'isochrone-source',
          paint: {
            'fill-color': '#10b981',
            'fill-opacity': 0.35,
          },
        });

        map.current.addLayer({
          id: 'isochrone-line',
          type: 'line',
          source: 'isochrone-source',
          paint: {
            'line-color': '#059669',
            'line-width': 2,
          },
        });

        map.current.flyTo({ center: [coords.lng, coords.lat], zoom: 14 });
      }
    } catch (err) {
      console.error('Audit execution error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex h-screen w-screen overflow-hidden font-sans">
      {/* Control Panel */}
      <div className="w-1/3 h-full bg-slate-900 text-white p-6 flex flex-col justify-between shadow-2xl z-10 overflow-y-auto">
        <div>
          <div className="flex items-center space-x-2 mb-6">
            <span className="text-emerald-400 font-black text-2xl tracking-wider">GROUNDTRUTH</span>
            <span className="text-xs bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded-full font-mono">
              PRODUCTION
            </span>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs uppercase text-slate-400 font-bold tracking-wider">
                  Target Location (GPS / Click Map)
                </label>
                {locating && (
                  <span className="text-[10px] text-emerald-400 animate-pulse font-mono">
                    Acquiring GPS...
                  </span>
                )}
              </div>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                onKeyDown={handleAddressSearch}
                placeholder="Type location & press Enter, or click anywhere on map"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm focus:border-emerald-500 focus:outline-none"
              />
              <div className="flex justify-between text-[11px] text-slate-500 mt-1 font-mono">
                <span>Lat: {coords.lat.toFixed(5)}</span>
                <span>Lng: {coords.lng.toFixed(5)}</span>
                <span
                  className="text-emerald-500 hover:underline cursor-pointer"
                  onClick={() => {
                    if (map.current) map.current.flyTo({ center: [coords.lng, coords.lat], zoom: 15 });
                  }}
                >
                  Center Pin
                </span>
              </div>
            </div>

            <div>
              <label className="text-xs uppercase text-slate-400 font-bold tracking-wider">
                Listing Description (Ad Copy)
              </label>
              <textarea
                rows={4}
                value={listingText}
                onChange={(e) => setListingText(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 mt-1 text-sm focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <button
              onClick={runAudit}
              disabled={loading}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-3 rounded-lg transition duration-200 disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Auditing Spatial Reality...' : 'Run GroundTruth Audit'}
            </button>
          </div>

          {/* Audit Output Results */}
          {auditResult && (
            <div className="mt-6 border-t border-slate-800 pt-4">
              <h3 className="text-sm font-semibold uppercase text-slate-400 mb-2">Audit Verdict</h3>
              <div className="bg-slate-800 p-3 rounded-lg border border-slate-700 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Cache Status:</span>
                  <span className="font-mono text-emerald-400">{auditResult.source}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">H3 Index:</span>
                  <span className="font-mono text-slate-300">{auditResult.h3Index}</span>
                </div>
                {auditResult.extractedClaims?.length > 0 && (
                  <div className="pt-2 border-t border-slate-700">
                    <span className="text-xs text-amber-400 font-semibold">Flagged Marketing Claims:</span>
                    {auditResult.extractedClaims.map((claim: any, idx: number) => (
                      <p key={idx} className="text-xs text-slate-300 mt-1">
                        • Claims {claim.claimed_time_minutes} min walk to "{claim.destination}"
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <p className="text-xs text-slate-500 text-center">
          GroundTruth © 2026. Zero-cost production geospatial architecture.
        </p>
      </div>

      {/* Map Viewport */}
      <div ref={mapContainer} className="w-2/3 h-full relative cursor-crosshair" />
    </main>
  );
}