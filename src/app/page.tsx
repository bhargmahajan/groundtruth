// src/app/page.tsx
"use client";

import React, { useState } from "react";
import LocationInput, { DEFAULT_BANGALORE, LocationData } from "@/components/LocationInput";
import RangeInput from "@/components/RangeInput";
import ReportDashboard from "@/components/ReportDashboard";
import { GroundTruthReport } from "@/lib/types";

export default function HomePage() {
  const [location, setLocation] = useState<LocationData>(DEFAULT_BANGALORE);
  const [radiusKm, setRadiusKm] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [report, setReport] = useState<GroundTruthReport | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleGenerateReport = async () => {
    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: location.lat,
          lng: location.lng,
          radiusKm,
        }),
      });

      const data = await res.json();
      if (data.status === "success") {
        console.group(
          `%c[GroundTruth] Report for ${location.label} (${radiusKm} km)`,
          "color: #38bdf8; font-weight: bold; font-size: 13px;"
        );
        console.log("Scores:", data.report.scores);
        console.table(data.report.amenities);
        console.log("Walkability:", data.report.walkability);
        console.log("Climate & AQI:", data.report.climate, data.report.airQuality);
        console.groupEnd();

        setReport(data.report);
      } else {
        setErrorMsg(data.message || "Could not generate report.");
      }
    } catch (err) {
      console.error("[GroundTruth Client Error]:", err);
      setErrorMsg("Network error while generating report. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center py-10 px-4 sm:px-6">
      <div className="w-full max-w-6xl space-y-8">
        <header className="border-b border-slate-800 pb-5 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">GroundTruth</h1>
            <p className="text-sm text-slate-400 mt-1">
              Civic Infrastructure, Environmental Sanity &amp; Pedestrian Reality Engine
            </p>
          </div>
          <span className="text-xs font-mono bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-full text-sky-400 self-start sm:self-auto">
            Zero-Cost Production V2
          </span>
        </header>

        {/* Input Control Bar */}
        <section className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 shadow-xl grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-6">
            <LocationInput value={location} onChange={setLocation} />
          </div>
          <div className="lg:col-span-3">
            <RangeInput radiusKm={radiusKm} onChange={setRadiusKm} />
          </div>
          <div className="lg:col-span-3 flex flex-col justify-end lg:pt-6 w-full">
            <button
              type="button"
              onClick={handleGenerateReport}
              disabled={loading}
              className="w-full py-3 px-5 bg-sky-600 hover:bg-sky-500 active:scale-[0.99] text-white font-semibold rounded-xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin text-white" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Scanning ({radiusKm} km)...
                </>
              ) : (
                "Generate Report"
              )}
            </button>
          </div>
        </section>

        {errorMsg && (
          <div className="p-4 rounded-xl bg-red-950/50 border border-red-800 text-xs text-red-300">
            {errorMsg}
          </div>
        )}

        {/* Render Dashboard */}
        {report && (
          <ReportDashboard
            report={report}
            radiusKm={radiusKm}
            locationLabel={location.label}
          />
        )}
      </div>
    </main>
  );
}