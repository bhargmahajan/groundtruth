// src/app/page.tsx
"use client";

import React, { useState } from "react";
import LocationModal from "@/components/LocationModal";

export default function GroundTruthDashboard() {
  const [coords, setCoords] = useState({ lat: 12.9716, lng: 77.5946 });
  const [locationLabel, setLocationLabel] = useState("Bengaluru, Karnataka");
  const [radiusKm, setRadiusKm] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<any>(null);

  const handleGenerateReport = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat: coords.lat, lng: coords.lng, radiusKm }),
      });
      const data = await res.json();
      if (data.status === "success") {
        setReport(data.metrics);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center py-12 px-4 sm:px-6">
      <LocationModal
        onLocationResolved={(loc) => {
          setCoords(loc.coords);
          setLocationLabel(loc.label);
        }}
      />

      <div className="w-full max-w-5xl space-y-8">
        <header className="border-b border-slate-800 pb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">GroundTruth</h1>
            <p className="text-sm text-slate-400 mt-1">Civic infrastructure & environmental sanity scanner</p>
          </div>
          <div className="text-xs bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-full text-slate-300">
            Zero-Cost Production Engine
          </div>
        </header>

        {/* Input Bar */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-md grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Target Coordinates</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={`${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`}
                onChange={(e) => {
                  const [lat, lng] = e.target.value.split(",").map((v) => parseFloat(v.trim()));
                  if (!isNaN(lat) && !isNaN(lng)) setCoords({ lat, lng });
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <span className="text-xs text-slate-500 block truncate">{locationLabel}</span>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Radius Scope</label>
              <span className="text-xs font-bold text-blue-400">{radiusKm} km</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="5"
              step="0.5"
              value={radiusKm}
              onChange={(e) => setRadiusKm(parseFloat(e.target.value))}
              className="w-full accent-blue-500"
            />
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>500m</span>
              <span>1 km (Default)</span>
              <span>5 km</span>
            </div>
          </div>

          <button
            onClick={handleGenerateReport}
            disabled={loading}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 font-semibold rounded-xl text-white transition disabled:opacity-50"
          >
            {loading ? "Scanning Terrain..." : "Generate Report"}
          </button>
        </section>

        {/* Report Output */}
        {report && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <span className="text-xs text-slate-400 font-medium">Civic Infrastructure</span>
                <p className="text-3xl font-bold mt-1 text-blue-400">{report.civicInfrastructureScore} / 100</p>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <span className="text-xs text-slate-400 font-medium">Environmental Score</span>
                <p className="text-3xl font-bold mt-1 text-emerald-400">{report.environmentalScore} / 100</p>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <span className="text-xs text-slate-400 font-medium">Commute Reality</span>
                <p className="text-3xl font-bold mt-1 text-amber-400">{report.commuteRealityScore} / 100</p>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <h3 className="text-base font-semibold text-white">Amenity Breakdown ({radiusKm} km Radius)</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block text-xs">Schools</span>
                  <span className="text-lg font-bold">{report.amenityBreakdown.schools}</span>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block text-xs">Hospitals / Clinics</span>
                  <span className="text-lg font-bold">{report.amenityBreakdown.hospitals}</span>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block text-xs">Pharmacies</span>
                  <span className="text-lg font-bold">{report.amenityBreakdown.pharmacies}</span>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block text-xs">Metro Stations</span>
                  <span className="text-lg font-bold">{report.amenityBreakdown.metroStations}</span>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block text-xs">Temples</span>
                  <span className="text-lg font-bold">{report.amenityBreakdown.temples}</span>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block text-xs">Mosques</span>
                  <span className="text-lg font-bold">{report.amenityBreakdown.mosques}</span>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block text-xs">Churches</span>
                  <span className="text-lg font-bold">{report.amenityBreakdown.churches}</span>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block text-xs">Waste Dumps / Canals</span>
                  <span className="text-lg font-bold text-red-400">
                    {report.amenityBreakdown.openDumps + report.amenityBreakdown.drainageCanals}
                  </span>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 text-xs text-slate-400 flex flex-col sm:flex-row justify-between gap-2">
                <span>
                  Walking Difficulty: <strong>{report.walkability.comfortRating}</strong> (~{report.walkability.estimatedMinutes} min walk)
                </span>
                <span>
                  Temperature: <strong>{report.climate.temperature}°C</strong> (Feels like {report.climate.feelsLike}°C)
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}