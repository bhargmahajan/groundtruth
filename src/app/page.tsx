'use client';

import React, { useState, useEffect, useRef } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';

export default function GroundTruthDashboard() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const marker = useRef<any>(null);
  const activePopup = useRef<any>(null);
  const maplibreglRef = useRef<any>(null);

  // Default coordinates: Bengaluru
  const [coords, setCoords] = useState<{ lat: number; lng: number }>({
    lat: 12.9716,
    lng: 77.5946,
  });

  const [address, setAddress] = useState<string>('MG Road, Bengaluru');
  const [distanceKm, setDistanceKm] = useState<number>(2);
  const [loading, setLoading] = useState<boolean>(false);
  const [showLocationModal, setShowLocationModal] = useState<boolean>(true);
  const [auditResult, setAuditResult] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'civic' | 'neighbourhood' | 'environment'>('civic');

  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
      );
      const data = await res.json();
      if (data?.display_name) {
        setAddress(data.display_name);
      }
    } catch {
      setAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    }
  };

  const handleAllowLocation = () => {
    setShowLocationModal(false);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setCoords({ lat, lng });
          if (map.current) map.current.flyTo({ center: [lng, lat], zoom: 15 });
          if (marker.current) marker.current.setLngLat([lng, lat]);
          reverseGeocode(lat, lng);
        },
        () => {
          reverseGeocode(coords.lat, coords.lng);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }
  };

  const handleDeclineLocation = () => {
    setShowLocationModal(false);
    reverseGeocode(coords.lat, coords.lng);
  };

  useEffect(() => {
    let isMounted = true;

    import('maplibre-gl').then((maplibreglModule: any) => {
      if (!isMounted || !mapContainer.current || map.current) return;

      const maplibregl = maplibreglModule.default || maplibreglModule;
      maplibreglRef.current = maplibregl;

      try {
        if (maplibregl.workerUrl !== undefined) {
          const workerBlob = new Blob(['self.onmessage = function() {};'], {
            type: 'application/javascript',
          });
          maplibregl.workerUrl = URL.createObjectURL(workerBlob);
        }
      } catch {}

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
        if (activePopup.current) activePopup.current.remove();
      });

      map.current.on('click', (e: any) => {
        const { lng, lat } = e.lngLat;
        marker.current.setLngLat([lng, lat]);
        setCoords({ lat, lng });
        reverseGeocode(lat, lng);
        if (activePopup.current) activePopup.current.remove();
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

  const handleAddressSearch = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && address.trim()) {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            address
          )}`
        );
        const data = await res.json();
        if (data?.[0]) {
          const newLat = parseFloat(data[0].lat);
          const newLng = parseFloat(data[0].lon);

          setCoords({ lat: newLat, lng: newLng });
          if (map.current) map.current.flyTo({ center: [newLng, newLat], zoom: 15 });
          if (marker.current) marker.current.setLngLat([newLng, newLat]);
          if (activePopup.current) activePopup.current.remove();
        }
      } catch (err) {
        console.error('Search forward geocoding failed:', err);
      }
    }
  };

  /**
   * Generates audit and binds spatial HUD overlays directly on top of the map
   */
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
          distanceKm,
        }),
      });

      const data = await res.json();
      setAuditResult(data);

      if (map.current && data.isochrone) {
        // Clean up existing map layers
        if (map.current.getLayer('isochrone-line')) map.current.removeLayer('isochrone-line');
        if (map.current.getLayer('isochrone-layer')) map.current.removeLayer('isochrone-layer');
        if (map.current.getSource('isochrone-source')) map.current.removeSource('isochrone-source');

        // Add Isochrone geometry layer
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
            'fill-opacity': 0.3,
          },
        });

        map.current.addLayer({
          id: 'isochrone-line',
          type: 'line',
          source: 'isochrone-source',
          paint: {
            'line-color': '#059669',
            'line-width': 2.5,
          },
        });

        // Focus map view to fit bounds
        map.current.flyTo({ center: [coords.lng, coords.lat], zoom: 14 });

        // Remove previous popup if exists
        if (activePopup.current) {
          activePopup.current.remove();
        }

        // Render an interactive On-Map HUD Popup directly over the marker
        const maplibregl = maplibreglRef.current;
        if (maplibregl) {
          const popupHtml = `
            <div style="font-family: system-ui, sans-serif; min-width: 260px; padding: 4px; color: #0f172a;">
              <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 8px;">
                <span style="font-weight: 800; font-size: 13px; color: #047857; text-transform: uppercase; letter-spacing: 0.5px;">GROUNDTRUTH AUDIT</span>
                <span style="font-size: 11px; background: #d1fae5; color: #065f46; padding: 2px 6px; border-radius: 9999px; font-weight: 700;">${distanceKm} KM WALKSPEC</span>
              </div>
              
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 8px;">
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 6px; text-align: center;">
                  <div style="font-size: 10px; color: #64748b; font-weight: 600; text-transform: uppercase;">Civic Infra</div>
                  <div style="font-size: 16px; font-weight: 900; color: #0f172a;">${data.scores?.civicInfrastructureScore ?? 'N/A'}<span style="font-size: 10px; font-weight: 400; color: #64748b;">/100</span></div>
                </div>
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 6px; text-align: center;">
                  <div style="font-size: 10px; color: #64748b; font-weight: 600; text-transform: uppercase;">Neighbourhood</div>
                  <div style="font-size: 16px; font-weight: 900; color: #0f172a;">${data.scores?.neighbourhoodScore ?? 'N/A'}<span style="font-size: 10px; font-weight: 400; color: #64748b;">/100</span></div>
                </div>
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 6px; text-align: center;">
                  <div style="font-size: 10px; color: #64748b; font-weight: 600; text-transform: uppercase;">Environment</div>
                  <div style="font-size: 16px; font-weight: 900; color: #0f172a;">${data.scores?.environmentalScore ?? 'N/A'}<span style="font-size: 10px; font-weight: 400; color: #64748b;">/100</span></div>
                </div>
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 6px; text-align: center;">
                  <div style="font-size: 10px; color: #64748b; font-weight: 600; text-transform: uppercase;">Walk Reality</div>
                  <div style="font-size: 16px; font-weight: 900; color: #0f172a;">${data.scores?.commuteRealityScore ?? 'N/A'}<span style="font-size: 10px; font-weight: 400; color: #64748b;">/100</span></div>
                </div>
              </div>

              <div style="font-size: 11px; background: #f1f5f9; padding: 6px 8px; border-radius: 6px; line-height: 1.4; color: #334155;">
                🏥 <strong>${data.breakdowns?.civic?.hospitalsNearby ?? 0}</strong> Hospitals &bull; 
                🏫 <strong>${data.breakdowns?.civic?.schoolsNearby ?? 0}</strong> Schools &bull; 
                🛒 <strong>${data.breakdowns?.civic?.groceryHubs ?? 0}</strong> Marts &bull;
                💊 <strong>${data.breakdowns?.civic?.chemistShops ?? 0}</strong> Chemists
              </div>
            </div>
          `;

          activePopup.current = new maplibregl.Popup({
            closeButton: true,
            closeOnClick: false,
            maxWidth: '320px',
            offset: 25,
          })
            .setLngLat([coords.lng, coords.lat])
            .setHTML(popupHtml)
            .addTo(map.current);
        }
      }
    } catch (err) {
      console.error('Audit execution error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getScoreBadgeColor = (val: number | string) => {
    if (typeof val !== 'number') return 'text-slate-400 border-slate-700 bg-slate-800';
    if (val >= 75) return 'text-emerald-400 border-emerald-800 bg-emerald-950/60';
    if (val >= 50) return 'text-amber-400 border-amber-800 bg-amber-950/60';
    return 'text-rose-400 border-rose-800 bg-rose-950/60';
  };

  return (
    <main className="flex flex-col lg:flex-row h-screen w-screen overflow-hidden font-sans bg-slate-950 text-slate-100">
      {/* Geolocation Decision Modal */}
      {showLocationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center space-x-3 mb-4">
              <span className="text-2xl">📍</span>
              <h3 className="text-lg font-bold text-white">Enable Accurate Location?</h3>
            </div>
            <p className="text-sm text-slate-300 mb-6 leading-relaxed">
              GroundTruth uses your coordinates to calculate real-world walking isochrones, nearby civic amenities, and flood hazards. Would you like to use your current GPS location or continue with the default position?
            </p>
            <div className="flex space-x-3 justify-end">
              <button
                type="button"
                onClick={handleDeclineLocation}
                className="px-4 py-2 text-xs font-semibold rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                Use Default Location
              </button>
              <button
                type="button"
                onClick={handleAllowLocation}
                className="px-5 py-2 text-xs font-semibold rounded-lg bg-emerald-500 hover:bg-emerald-600 text-slate-950 transition font-bold"
              >
                Allow GPS Location
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Control & Results Sidebar */}
      <div className="w-full lg:w-[460px] h-full bg-slate-900 border-r border-slate-800 flex flex-col justify-between shadow-2xl z-20 overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-2">
              <span className="text-emerald-400 font-black text-2xl tracking-wider">GROUNDTRUTH</span>
              <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded-full font-mono uppercase">
                GEOSPATIAL
              </span>
            </div>
          </div>

          {/* Form Inputs */}
          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs uppercase text-slate-400 font-bold tracking-wider">
                  Target Location (Click Map or Search)
                </label>
                <button
                  type="button"
                  onClick={handleAllowLocation}
                  className="text-xs text-emerald-400 hover:underline flex items-center space-x-1"
                >
                  <span>📍 GPS Locate</span>
                </button>
              </div>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                onKeyDown={handleAddressSearch}
                placeholder="Type location & press Enter"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm focus:border-emerald-500 focus:outline-none transition"
              />
              <div className="flex justify-between text-[11px] text-slate-500 mt-1 font-mono">
                <span>Lat: {coords.lat.toFixed(4)}</span>
                <span>Lng: {coords.lng.toFixed(4)}</span>
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

            {/* Walking Distance Slider */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <label className="uppercase text-slate-400 font-bold tracking-wider">
                  Walking Audit Range
                </label>
                <span className="font-mono text-emerald-400 font-semibold">{distanceKm} km</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="5"
                step="0.5"
                value={distanceKm}
                onChange={(e) => setDistanceKm(parseFloat(e.target.value))}
                className="w-full accent-emerald-500 bg-slate-800 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-0.5">
                <span>0.5 km (~6 min)</span>
                <span>Default: 2 km (~25 min)</span>
                <span>5 km</span>
              </div>
            </div>

            <button
              onClick={runAudit}
              disabled={loading}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-3 rounded-lg transition duration-200 disabled:opacity-50 cursor-pointer text-sm uppercase tracking-wider"
            >
              {loading ? 'Auditing Spatial Reality...' : 'Generate GroundTruth Report'}
            </button>
          </div>

          {/* Audit Results Dashboard */}
          {auditResult && (
            <div className="mt-6 border-t border-slate-800 pt-5 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Verified Summary
                </h3>
                <span className="text-[11px] text-emerald-400 bg-emerald-950 border border-emerald-800 px-2 py-0.5 rounded-full font-mono">
                  VISUALIZED ON MAP
                </span>
              </div>

              {/* 4 Core Score Cards */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className={`p-3 rounded-xl border ${getScoreBadgeColor(auditResult.scores?.civicInfrastructureScore)}`}>
                  <div className="text-[11px] font-medium opacity-80 uppercase">Civic Infra</div>
                  <div className="text-2xl font-black mt-1">
                    {auditResult.scores?.civicInfrastructureScore ?? 'No data'}
                    {typeof auditResult.scores?.civicInfrastructureScore === 'number' && <span className="text-xs font-normal">/100</span>}
                  </div>
                </div>

                <div className={`p-3 rounded-xl border ${getScoreBadgeColor(auditResult.scores?.neighbourhoodScore)}`}>
                  <div className="text-[11px] font-medium opacity-80 uppercase">Neighbourhood</div>
                  <div className="text-2xl font-black mt-1">
                    {auditResult.scores?.neighbourhoodScore ?? 'No data'}
                    {typeof auditResult.scores?.neighbourhoodScore === 'number' && <span className="text-xs font-normal">/100</span>}
                  </div>
                </div>

                <div className={`p-3 rounded-xl border ${getScoreBadgeColor(auditResult.scores?.environmentalScore)}`}>
                  <div className="text-[11px] font-medium opacity-80 uppercase">Environmental</div>
                  <div className="text-2xl font-black mt-1">
                    {auditResult.scores?.environmentalScore ?? 'No data'}
                    {typeof auditResult.scores?.environmentalScore === 'number' && <span className="text-xs font-normal">/100</span>}
                  </div>
                </div>

                <div className={`p-3 rounded-xl border ${getScoreBadgeColor(auditResult.scores?.commuteRealityScore)}`}>
                  <div className="text-[11px] font-medium opacity-80 uppercase">Commute Reality</div>
                  <div className="text-2xl font-black mt-1">
                    {auditResult.scores?.commuteRealityScore ?? 'No data'}
                    {typeof auditResult.scores?.commuteRealityScore === 'number' && <span className="text-xs font-normal">/100</span>}
                  </div>
                </div>
              </div>

              {/* Breakdown Tab Switcher */}
              <div className="flex border-b border-slate-800 pt-2 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setActiveTab('civic')}
                  className={`pb-2 mr-4 ${activeTab === 'civic' ? 'text-emerald-400 border-b-2 border-emerald-400' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  Civic Amenities
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('neighbourhood')}
                  className={`pb-2 mr-4 ${activeTab === 'neighbourhood' ? 'text-emerald-400 border-b-2 border-emerald-400' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  Neighbourhood
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('environment')}
                  className={`pb-2 ${activeTab === 'environment' ? 'text-emerald-400 border-b-2 border-emerald-400' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  Environment
                </button>
              </div>

              {/* Tab Details */}
              <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800 text-xs space-y-2">
                {activeTab === 'civic' && (
                  <>
                    <div className="flex justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400">Hospitals / Clinics:</span>
                      <span className="font-semibold text-slate-200">{auditResult.breakdowns?.civic?.hospitalsNearby ?? 'No data'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400">Schools:</span>
                      <span className="font-semibold text-slate-200">{auditResult.breakdowns?.civic?.schoolsNearby ?? 'No data'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400">Grocery Stores / Supermarkets:</span>
                      <span className="font-semibold text-slate-200">{auditResult.breakdowns?.civic?.groceryHubs ?? 'No data'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400">Pharmacies / Chemist Shops:</span>
                      <span className="font-semibold text-slate-200">{auditResult.breakdowns?.civic?.chemistShops ?? 'No data'}</span>
                    </div>
                    <div className="py-1 border-b border-slate-800/60">
                      <span className="text-slate-400 block mb-0.5">E-Commerce Deliveries:</span>
                      <span className="text-emerald-400 text-[11px]">{auditResult.breakdowns?.civic?.deliveryAvailability ?? 'No data'}</span>
                    </div>
                    <div className="py-1">
                      <span className="text-slate-400 block mb-0.5">Ride Hailing:</span>
                      <span className="text-emerald-400 text-[11px]">{auditResult.breakdowns?.civic?.onlineRidesAvailability ?? 'No data'}</span>
                    </div>
                  </>
                )}

                {activeTab === 'neighbourhood' && (
                  <>
                    <div className="flex justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400">Schooling Cluster:</span>
                      <span className="font-semibold text-slate-200">{auditResult.breakdowns?.neighbourhood?.schoolingQuality ?? 'No data'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400">Crime Risk Index:</span>
                      <span className="font-semibold text-slate-200">{auditResult.breakdowns?.neighbourhood?.crimeStatistics ?? 'No data'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400">Water Supply:</span>
                      <span className="font-semibold text-slate-200">{auditResult.breakdowns?.neighbourhood?.waterAvailability ?? 'No data'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400">Power Outages:</span>
                      <span className="font-semibold text-slate-200">{auditResult.breakdowns?.neighbourhood?.powerOutageFrequency ?? 'No data'}</span>
                    </div>
                    <div className="py-1 border-b border-slate-800/60">
                      <span className="text-slate-400 block mb-0.5">Waste Dump / Open Sewage Canal:</span>
                      <span className="text-amber-400 text-[11px]">{auditResult.breakdowns?.neighbourhood?.dumpWasteOrSewageCanal ?? 'No data'}</span>
                    </div>
                    <div className="py-1">
                      <span className="text-slate-400 block mb-0.5">Future Infrastructure Plans:</span>
                      <span className="text-slate-300 text-[11px]">{auditResult.breakdowns?.neighbourhood?.futureInfrastructurePlans ?? 'No data'}</span>
                    </div>
                  </>
                )}

                {activeTab === 'environment' && (
                  <>
                    <div className="flex justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400">Monsoon Vulnerability:</span>
                      <span className="font-semibold text-amber-400">{auditResult.breakdowns?.environmental?.monsoonVulnerability ?? 'No data'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400">Air Quality Index:</span>
                      <span className="font-semibold text-slate-200">{auditResult.breakdowns?.environmental?.airQualityIndex ?? 'No data'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400">Temperature & Microclimate:</span>
                      <span className="font-semibold text-slate-200">{auditResult.breakdowns?.environmental?.generalTemperature ?? 'No data'}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-400">Solar Heat Impedance:</span>
                      <span className="font-semibold text-slate-300">{auditResult.breakdowns?.environmental?.thermalHeatPenalty ?? 'No data'}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-800 text-[11px] text-slate-500 text-center">
          GroundTruth © 2026. Empirical due diligence & geospatial intelligence.
        </div>
      </div>

      {/* Main Map Viewport with Visual Overlay Controls */}
      <div className="flex-1 h-[50vh] lg:h-full relative cursor-crosshair">
        <div ref={mapContainer} className="w-full h-full" />
        
        {/* Floating Map Legend Indicator */}
        {auditResult && (
          <div className="absolute top-4 right-4 bg-slate-900/90 backdrop-blur border border-slate-800 px-3 py-2 rounded-xl text-[11px] text-slate-300 shadow-xl flex items-center space-x-3 pointer-events-none z-10">
            <div className="flex items-center space-x-1.5">
              <span className="w-3 h-3 rounded-full bg-emerald-500/40 border border-emerald-400 inline-block" />
              <span>{distanceKm} km Reach Boundary</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />
              <span>Target Coordinates</span>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}