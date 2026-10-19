'use client';

import React, { useState, useEffect, useRef } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';

export default function GroundTruthDashboard() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);

  const [address, setAddress] = useState('MG Road, Bengaluru');
  const [listingText, setListingText] = useState('Spacious 3BHK just 5 mins walk to Metro station.');
  const [loading, setLoading] = useState(false);
  const [auditResult, setAuditResult] = useState<any>(null);

  useEffect(() => {
    let isMounted = true;

    // Dynamically load MapLibre on the client
    import('maplibre-gl').then((maplibreglModule) => {
      if (!isMounted || !mapContainer.current || map.current) return;

      const maplibregl = maplibreglModule;

      // Define standard raster style (eliminates vector tile worker discrepancies)
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
        center: [77.5946, 12.9716], // Default Bengaluru
        zoom: 13,
      });
    });

    return () => {
      isMounted = false;
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  const runAudit = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/audit/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address,
          latitude: 12.9756,
          longitude: 77.6066,
          rawListingText: listingText,
        }),
      });

      const data = await res.json();
      setAuditResult(data);

      if (map.current && data.isochrone) {
        // Remove existing layers if present
        if (map.current.getLayer('isochrone-line')) {
          map.current.removeLayer('isochrone-line');
        }
        if (map.current.getLayer('isochrone-layer')) {
          map.current.removeLayer('isochrone-layer');
        }
        if (map.current.getSource('isochrone-source')) {
          map.current.removeSource('isochrone-source');
        }

        // Add Isochrone Polygon to Map
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

        map.current.flyTo({ center: [77.6066, 12.9756], zoom: 14 });
      }
    } catch (err) {
      console.error('Audit failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex h-screen w-screen overflow-hidden font-sans">
      {/* Left Control Panel */}
      <div className="w-1/3 h-full bg-slate-900 text-white p-6 flex flex-col justify-between shadow-2xl z-10 overflow-y-auto">
        <div>
          <div className="flex items-center space-x-2 mb-6">
            <span className="text-emerald-400 font-black text-2xl tracking-wider">GROUNDTRUTH</span>
            <span className="text-xs bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded-full font-mono">
              BETA
            </span>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs uppercase text-slate-400 font-bold tracking-wider">Property Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 mt-1 text-sm focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs uppercase text-slate-400 font-bold tracking-wider">Listing Description (Ad Copy)</label>
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

          {/* Audit Results Section */}
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

      {/* Right Map Canvas */}
      <div ref={mapContainer} className="w-2/3 h-full relative" />
    </main>
  );
}