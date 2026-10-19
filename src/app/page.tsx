'use client';

import React, { useState, useEffect, useRef } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';

export default function GroundTruthDashboard() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const targetMarkerRef = useRef<any>(null);
  const amenityMarkersRef = useRef<any[]>([]);
  const amenityPopupRef = useRef<any>(null);
  const maplibreglRef = useRef<any>(null);

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

  const [visibleFilters, setVisibleFilters] = useState<{
    hospital: boolean;
    school: boolean;
    grocery: boolean;
    pharmacy: boolean;
    temple: boolean;
    masjid: boolean;
    church: boolean;
  }>({
    hospital: true,
    school: true,
    grocery: true,
    pharmacy: true,
    temple: true,
    masjid: true,
    church: true,
  });

  const calculateDistanceMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return Math.round(R * c);
  };

  const clearAmenityPins = () => {
    amenityMarkersRef.current.forEach((m) => m.remove());
    amenityMarkersRef.current = [];

    if (amenityPopupRef.current) {
      amenityPopupRef.current.remove();
      amenityPopupRef.current = null;
    }
  };

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

  const updateTargetMarker = (lng: number, lat: number) => {
    if (!map.current || !maplibreglRef.current) return;

    if (!targetMarkerRef.current) {
      const el = document.createElement('div');
      el.style.width = '24px';
      el.style.height = '24px';
      el.style.backgroundColor = '#10b981';
      el.style.borderRadius = '50%';
      el.style.border = '3px solid #ffffff';
      el.style.boxShadow = '0 0 15px rgba(16, 185, 129, 0.9)';
      el.style.cursor = 'grab';

      targetMarkerRef.current = new maplibreglRef.current.Marker({
        element: el,
        draggable: true,
      })
        .setLngLat([lng, lat])
        .addTo(map.current);

      targetMarkerRef.current.on('dragend', () => {
        const lngLat = targetMarkerRef.current.getLngLat();
        setCoords({ lat: lngLat.lat, lng: lngLat.lng });
        clearAmenityPins();
        setAuditResult(null);
        reverseGeocode(lngLat.lat, lngLat.lng);
      });
    } else {
      targetMarkerRef.current.setLngLat([lng, lat]);
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
          clearAmenityPins();
          setAuditResult(null);
          if (map.current) map.current.flyTo({ center: [lng, lat], zoom: 15 });
          updateTargetMarker(lng, lat);
          reverseGeocode(lat, lng);
        },
        () => {
          reverseGeocode(coords.lat, coords.lng);
          updateTargetMarker(coords.lng, coords.lat);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }
  };

  const handleDeclineLocation = () => {
    setShowLocationModal(false);
    updateTargetMarker(coords.lng, coords.lat);
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

      map.current.on('load', () => {
        updateTargetMarker(coords.lng, coords.lat);
      });

      map.current.on('click', (e: any) => {
        if (e.originalEvent?.defaultPrevented) return;

        const { lng, lat } = e.lngLat;
        setCoords({ lat, lng });
        updateTargetMarker(lng, lat);
        clearAmenityPins();
        setAuditResult(null);
        reverseGeocode(lat, lng);
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
          updateTargetMarker(newLng, newLat);
          clearAmenityPins();
          setAuditResult(null);
          if (map.current) map.current.flyTo({ center: [newLng, newLat], zoom: 15 });
        }
      } catch (err) {
        console.error('Search error:', err);
      }
    }
  };

  const renderAmenityPins = (points: any[]) => {
    clearAmenityPins();
    const maplibregl = maplibreglRef.current;
    if (!map.current || !maplibregl || !Array.isArray(points)) return;

    const typeConfig: Record<string, { color: string; icon: string; label: string }> = {
      hospital: { color: '#ef4444', icon: '🏥', label: 'Hospital/Clinic' },
      school: { color: '#3b82f6', icon: '🏫', label: 'School' },
      grocery: { color: '#10b981', icon: '🛒', label: 'Market/Grocery' },
      pharmacy: { color: '#a855f7', icon: '💊', label: 'Pharmacy' },
      temple: { color: '#f97316', icon: '🛕', label: 'Temple' },
      masjid: { color: '#06b6d4', icon: '🕌', label: 'Masjid' },
      church: { color: '#eab308', icon: '⛪', label: 'Church' },
    };

    points.forEach((pt: any) => {
      const lat = typeof pt.lat === 'number' ? pt.lat : parseFloat(pt.lat);
      const lng = typeof pt.lng === 'number' ? pt.lng : parseFloat(pt.lng);

      if (isNaN(lat) || isNaN(lng)) return;

      const cfg = typeConfig[pt.type] || { color: '#64748b', icon: '📍', label: 'Amenity' };

      const distanceMeters = calculateDistanceMeters(coords.lat, coords.lng, lat, lng);
      const walkingMinutes = Math.max(1, Math.round(distanceMeters / 80));
      const formattedDistance =
        distanceMeters >= 1000
          ? `${(distanceMeters / 1000).toFixed(2)} km`
          : `${distanceMeters} m`;

      const el = document.createElement('div');
      el.className = 'amenity-marker';
      el.dataset.type = pt.type;
      el.style.width = '30px';
      el.style.height = '30px';
      el.style.backgroundColor = cfg.color;
      el.style.borderRadius = '50%';
      el.style.border = '2px solid #ffffff';
      el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.45)';
      el.style.display = visibleFilters[pt.type as keyof typeof visibleFilters] ? 'flex' : 'none';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
      el.style.cursor = 'pointer';
      el.style.fontSize = '14px';
      el.innerHTML = cfg.icon;

      const tooltipHtml = `
        <div style="font-family: system-ui, sans-serif; padding: 4px; color: #0f172a; min-width: 180px;">
          <div style="font-size: 10px; color: ${cfg.color}; font-weight: 800; text-transform: uppercase;">
            ${cfg.label}
          </div>
          <div style="font-size: 13px; font-weight: 700; margin-top: 2px; color: #0f172a;">
            ${pt.name}
          </div>
          <div style="font-size: 11px; color: #475569; margin-top: 4px; border-top: 1px solid #e2e8f0; padding-top: 4px; display: flex; justify-content: space-between;">
            <span>🚶 <strong>${formattedDistance}</strong></span>
            <span>⏱️ <strong>~${walkingMinutes} min walk</strong></span>
          </div>
        </div>
      `;

      el.addEventListener('mouseenter', () => {
        if (amenityPopupRef.current) amenityPopupRef.current.remove();
        amenityPopupRef.current = new maplibregl.Popup({
          offset: 15,
          closeButton: false,
          closeOnClick: false,
        })
          .setLngLat([lng, lat])
          .setHTML(tooltipHtml)
          .addTo(map.current);
      });

      el.addEventListener('mouseleave', () => {
        if (amenityPopupRef.current) {
          amenityPopupRef.current.remove();
          amenityPopupRef.current = null;
        }
      });

      el.addEventListener('click', (event) => {
        event.stopPropagation();
        event.preventDefault();

        if (amenityPopupRef.current) amenityPopupRef.current.remove();
        amenityPopupRef.current = new maplibregl.Popup({
          offset: 15,
          closeButton: true,
          closeOnClick: false,
        })
          .setLngLat([lng, lat])
          .setHTML(tooltipHtml)
          .addTo(map.current);
      });

      const mapMarker = new maplibregl.Marker({ element: el })
        .setLngLat([lng, lat])
        .addTo(map.current);

      amenityMarkersRef.current.push(mapMarker);
    });
  };

  const toggleFilter = (type: keyof typeof visibleFilters) => {
    const nextState = !visibleFilters[type];
    setVisibleFilters((prev) => ({ ...prev, [type]: nextState }));

    amenityMarkersRef.current.forEach((m) => {
      const el = m.getElement();
      if (el && el.dataset.type === type) {
        el.style.display = nextState ? 'flex' : 'none';
      }
    });
  };

  const runAudit = async () => {
    setLoading(true);
    clearAmenityPins();

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
        const sourceData = {
          type: 'Feature',
          geometry: data.isochrone,
          properties: {},
        };

        const existingSource = map.current.getSource('isochrone-source');
        if (existingSource) {
          existingSource.setData(sourceData);
        } else {
          map.current.addSource('isochrone-source', {
            type: 'geojson',
            data: sourceData,
          });

          map.current.addLayer({
            id: 'isochrone-layer',
            type: 'fill',
            source: 'isochrone-source',
            paint: {
              'fill-color': '#10b981',
              'fill-opacity': 0.22,
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
        }

        map.current.flyTo({ center: [coords.lng, coords.lat], zoom: 14 });
        updateTargetMarker(coords.lng, coords.lat);

        if (data.amenityPoints) {
          renderAmenityPins(data.amenityPoints);
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
              GroundTruth uses your precise coordinates to audit local amenities, monsoon waterlogging risks, and walking boundaries. Would you like to use your current GPS location or continue with the default position?
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
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-2">
              <span className="text-emerald-400 font-black text-2xl tracking-wider">GROUNDTRUTH</span>
              <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded-full font-mono uppercase">
                GEOSPATIAL
              </span>
            </div>
          </div>

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
                onChange={(e) => {
                  setAddress(e.target.value);
                  clearAmenityPins();
                  setAuditResult(null);
                }}
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
                onChange={(e) => {
                  setDistanceKm(parseFloat(e.target.value));
                  clearAmenityPins();
                  setAuditResult(null);
                }}
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
                  ALL {auditResult.amenityPoints?.length ?? 0} POIs ON MAP
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
                      <span className="font-semibold text-rose-400">{auditResult.breakdowns?.civic?.hospitalsNearby ?? 0}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400">Schools:</span>
                      <span className="font-semibold text-blue-400">{auditResult.breakdowns?.civic?.schoolsNearby ?? 0}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400">Grocery Stores / Markets:</span>
                      <span className="font-semibold text-emerald-400">{auditResult.breakdowns?.civic?.groceryHubs ?? 0}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400">Pharmacies / Chemists:</span>
                      <span className="font-semibold text-purple-400">{auditResult.breakdowns?.civic?.chemistShops ?? 0}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400">Temples / Mandirs:</span>
                      <span className="font-semibold text-amber-400">{auditResult.breakdowns?.civic?.templesNearby ?? 0}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400">Masjids / Mosques:</span>
                      <span className="font-semibold text-cyan-400">{auditResult.breakdowns?.civic?.masjidsNearby ?? 0}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400">Churches:</span>
                      <span className="font-semibold text-yellow-400">{auditResult.breakdowns?.civic?.churchesNearby ?? 0}</span>
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
                    <div className="flex justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400 block mb-0.5">Waste Dump / Open Sewage Canal:</span>
                      <span className="text-amber-400 text-[11px]">{auditResult.breakdowns?.neighbourhood?.dumpWasteOrSewageCanal ?? 'No data'}</span>
                    </div>
                    <div className="py-1">
                      <span className="text-slate-400 block mb-0.5">Worship Infrastructure:</span>
                      <span className="text-slate-300 text-[11px]">{auditResult.breakdowns?.neighbourhood?.placesOfWorshipSummary ?? 'No data'}</span>
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

      {/* Main Map Viewport */}
      <div className="flex-1 h-[50vh] lg:h-full relative cursor-crosshair">
        <div ref={mapContainer} className="w-full h-full" />

        {/* POI Filter Toolbar */}
        {auditResult && (
          <div className="absolute top-4 left-4 bg-slate-900/90 backdrop-blur border border-slate-800 p-2 rounded-xl text-xs text-slate-200 shadow-2xl flex flex-wrap items-center gap-1.5 z-10 max-w-xl">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1">Amenities:</span>
            <button
              type="button"
              onClick={() => toggleFilter('hospital')}
              className={`px-2 py-0.5 rounded-lg border text-xs font-semibold flex items-center space-x-1 transition cursor-pointer ${
                visibleFilters.hospital
                  ? 'bg-rose-950/80 border-rose-700 text-rose-300'
                  : 'bg-slate-800 border-slate-700 text-slate-500 line-through'
              }`}
            >
              <span>🏥</span>
              <span>Hospitals ({auditResult.breakdowns?.civic?.hospitalsNearby ?? 0})</span>
            </button>
            <button
              type="button"
              onClick={() => toggleFilter('school')}
              className={`px-2 py-0.5 rounded-lg border text-xs font-semibold flex items-center space-x-1 transition cursor-pointer ${
                visibleFilters.school
                  ? 'bg-blue-950/80 border-blue-700 text-blue-300'
                  : 'bg-slate-800 border-slate-700 text-slate-500 line-through'
              }`}
            >
              <span>🏫</span>
              <span>Schools ({auditResult.breakdowns?.civic?.schoolsNearby ?? 0})</span>
            </button>
            <button
              type="button"
              onClick={() => toggleFilter('grocery')}
              className={`px-2 py-0.5 rounded-lg border text-xs font-semibold flex items-center space-x-1 transition cursor-pointer ${
                visibleFilters.grocery
                  ? 'bg-emerald-950/80 border-emerald-700 text-emerald-300'
                  : 'bg-slate-800 border-slate-700 text-slate-500 line-through'
              }`}
            >
              <span>🛒</span>
              <span>Markets ({auditResult.breakdowns?.civic?.groceryHubs ?? 0})</span>
            </button>
            <button
              type="button"
              onClick={() => toggleFilter('pharmacy')}
              className={`px-2 py-0.5 rounded-lg border text-xs font-semibold flex items-center space-x-1 transition cursor-pointer ${
                visibleFilters.pharmacy
                  ? 'bg-purple-950/80 border-purple-700 text-purple-300'
                  : 'bg-slate-800 border-slate-700 text-slate-500 line-through'
              }`}
            >
              <span>💊</span>
              <span>Pharmacies ({auditResult.breakdowns?.civic?.chemistShops ?? 0})</span>
            </button>
            <button
              type="button"
              onClick={() => toggleFilter('temple')}
              className={`px-2 py-0.5 rounded-lg border text-xs font-semibold flex items-center space-x-1 transition cursor-pointer ${
                visibleFilters.temple
                  ? 'bg-amber-950/80 border-amber-700 text-amber-300'
                  : 'bg-slate-800 border-slate-700 text-slate-500 line-through'
              }`}
            >
              <span>🛕</span>
              <span>Temples ({auditResult.breakdowns?.civic?.templesNearby ?? 0})</span>
            </button>
            <button
              type="button"
              onClick={() => toggleFilter('masjid')}
              className={`px-2 py-0.5 rounded-lg border text-xs font-semibold flex items-center space-x-1 transition cursor-pointer ${
                visibleFilters.masjid
                  ? 'bg-cyan-950/80 border-cyan-700 text-cyan-300'
                  : 'bg-slate-800 border-slate-700 text-slate-500 line-through'
              }`}
            >
              <span>🕌</span>
              <span>Masjids ({auditResult.breakdowns?.civic?.masjidsNearby ?? 0})</span>
            </button>
            <button
              type="button"
              onClick={() => toggleFilter('church')}
              className={`px-2 py-0.5 rounded-lg border text-xs font-semibold flex items-center space-x-1 transition cursor-pointer ${
                visibleFilters.church
                  ? 'bg-yellow-950/80 border-yellow-700 text-yellow-300'
                  : 'bg-slate-800 border-slate-700 text-slate-500 line-through'
              }`}
            >
              <span>⛪</span>
              <span>Churches ({auditResult.breakdowns?.civic?.churchesNearby ?? 0})</span>
            </button>
          </div>
        )}

        {/* Legend */}
        {auditResult && (
          <div className="absolute top-4 right-4 bg-slate-900/90 backdrop-blur border border-slate-800 px-3 py-2 rounded-xl text-[11px] text-slate-300 shadow-xl flex items-center space-x-3 pointer-events-none z-10">
            <div className="flex items-center space-x-1.5">
              <span className="w-3 h-3 rounded-full bg-emerald-500/30 border border-emerald-400 inline-block" />
              <span>{distanceKm} km Isochrone</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />
              <span>Target Pin</span>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}