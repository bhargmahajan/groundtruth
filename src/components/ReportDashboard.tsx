// src/components/ReportDashboard.tsx
"use client";

import React from "react";
import { GroundTruthReport } from "@/lib/types";

interface ReportDashboardProps {
  report: GroundTruthReport;
  radiusKm: number;
  locationLabel: string;
}

function ScoreGauge({
  title,
  score,
  subtitle,
  colorHex,
}: {
  title: string;
  score: number;
  subtitle: string;
  colorHex: string;
}) {
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 flex items-center justify-between gap-4 shadow-lg">
      <div className="space-y-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
          {title}
        </span>
        <div className="text-3xl font-extrabold text-white">{score}<span className="text-sm text-slate-500 font-normal">/100</span></div>
        <span className="text-[11px] text-slate-400 block">{subtitle}</span>
      </div>
      <div className="relative w-20 h-20 flex items-center justify-center shrink-0">
        <svg className="w-20 h-20 -rotate-90" viewBox="0 0 84 84">
          <circle
            cx="42"
            cy="42"
            r={radius}
            stroke="#1e293b"
            strokeWidth="7"
            fill="transparent"
          />
          <circle
            cx="42"
            cy="42"
            r={radius}
            stroke={colorHex}
            strokeWidth="7"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            fill="transparent"
          />
        </svg>
        <span className="absolute text-xs font-bold font-mono text-slate-200">{score}%</span>
      </div>
    </div>
  );
}

function RadarChart({ scores }: { scores: GroundTruthReport["scores"] }) {
  // 4 Axes: Top (Civic), Right (Environment), Bottom (Scout), Left (Commute)
  const size = 220;
  const center = size / 2;
  const maxR = 75;

  const topY = center - (scores.civicInfrastructureScore / 100) * maxR;
  const rightX = center + (scores.environmentalScore / 100) * maxR;
  const bottomY = center + (scores.neighbourhoodScoutScore / 100) * maxR;
  const leftX = center - (scores.commuteRealityScore / 100) * maxR;

  const polygonPoints = `${center},${topY} ${rightX},${center} ${center},${bottomY} ${leftX},${center}`;

  return (
    <div className="flex flex-col items-center justify-center">
      <svg width={size} height={size} className="overflow-visible">
        {/* Background Concentric Diamonds */}
        {[0.25, 0.5, 0.75, 1].map((scale) => {
          const r = maxR * scale;
          return (
            <polygon
              key={scale}
              points={`${center},${center - r} ${center + r},${center} ${center},${center + r} ${center - r},${center}`}
              fill="none"
              stroke="#1e293b"
              strokeWidth="1"
            />
          );
        })}
        {/* Axis Lines */}
        <line x1={center} y1={center - maxR} x2={center} y2={center + maxR} stroke="#334155" strokeDasharray="3 3" />
        <line x1={center - maxR} y1={center} x2={center + maxR} y2={center} stroke="#334155" strokeDasharray="3 3" />

        {/* Data Polygon */}
        <polygon
          points={polygonPoints}
          fill="rgba(56, 189, 248, 0.22)"
          stroke="#38bdf8"
          strokeWidth="2.5"
        />

        {/* Data Vertices */}
        <circle cx={center} cy={topY} r="4" fill="#38bdf8" />
        <circle cx={rightX} cy={center} r="4" fill="#34d399" />
        <circle cx={center} cy={bottomY} r="4" fill="#a855f7" />
        <circle cx={leftX} cy={center} r="4" fill="#fbbf24" />

        {/* Labels */}
        <text x={center} y={center - maxR - 10} textAnchor="middle" className="fill-sky-400 text-[10px] font-semibold">
          CIVIC ({scores.civicInfrastructureScore})
        </text>
        <text x={center + maxR + 8} y={center + 3} textAnchor="start" className="fill-emerald-400 text-[10px] font-semibold">
          ENV ({scores.environmentalScore})
        </text>
        <text x={center} y={center + maxR + 16} textAnchor="middle" className="fill-purple-400 text-[10px] font-semibold">
          SCOUT ({scores.neighbourhoodScoutScore})
        </text>
        <text x={center - maxR - 8} y={center + 3} textAnchor="end" className="fill-amber-400 text-[10px] font-semibold">
          COMMUTE ({scores.commuteRealityScore})
        </text>
      </svg>
    </div>
  );
}

export default function ReportDashboard({ report, radiusKm, locationLabel }: ReportDashboardProps) {
  const { scores, amenities, climate, airQuality, walkability, qualitative } = report;

  const maxAmenityCount = Math.max(
    1,
    amenities.schools,
    amenities.hospitals,
    amenities.groceryAndMarkets,
    amenities.chemistShops,
    amenities.temples + amenities.mosques + amenities.churches,
    amenities.metroStations
  );

  const amenityBars = [
    { label: "Schools & Education", count: amenities.schools, color: "bg-sky-500" },
    { label: "Hospitals & Clinics", count: amenities.hospitals, color: "bg-rose-500" },
    { label: "Grocery & Markets", count: amenities.groceryAndMarkets, color: "bg-emerald-500" },
    { label: "Chemist & Pharmacies", count: amenities.chemistShops, color: "bg-teal-500" },
    {
      label: "Places of Worship",
      count: amenities.temples + amenities.mosques + amenities.churches,
      color: "bg-purple-500",
    },
    { label: "Metro & Transit Nodes", count: amenities.metroStations, color: "bg-amber-500" },
  ];

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-300">
      {/* 1. Top Summary Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-sky-950/40 border border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-xs uppercase tracking-wider text-sky-400 font-semibold">
              Live GroundTruth Telemetry • {radiusKm} km Radius
            </span>
          </div>
          <h2 className="text-2xl font-bold text-white mt-1">{locationLabel}</h2>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-slate-950/90 border border-slate-800 px-4 py-2 rounded-xl">
            <span className="text-[10px] uppercase text-slate-400 block">Ambient Temp</span>
            <span className="text-sm font-bold text-white">
              {climate.temperature}°C <span className="text-xs text-slate-400 font-normal">(Feels {climate.feelsLike}°C)</span>
            </span>
          </div>
          <div className="bg-slate-950/90 border border-slate-800 px-4 py-2 rounded-xl">
            <span className="text-[10px] uppercase text-slate-400 block">US AQI / PM2.5</span>
            <span className="text-sm font-bold text-teal-400">
              {airQuality.aqi} AQI <span className="text-xs text-slate-400 font-normal">({airQuality.pm25} µg/m³)</span>
            </span>
          </div>
        </div>
      </div>

      {/* 2. 4 Core Score Gauges */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ScoreGauge
          title="Civic Infrastructure"
          score={scores.civicInfrastructureScore}
          subtitle="Schools, health, markets & transit"
          colorHex="#38bdf8"
        />
        <ScoreGauge
          title="Environmental Score"
          score={scores.environmentalScore}
          subtitle="AQI, greenery, dumps & drains"
          colorHex="#34d399"
        />
        <ScoreGauge
          title="Neighbourhood Scout"
          score={scores.neighbourhoodScoutScore}
          subtitle="Composite livability index"
          colorHex="#a855f7"
        />
        <ScoreGauge
          title="Commute Reality"
          score={scores.commuteRealityScore}
          subtitle="Road proximity & climate drag"
          colorHex="#fbbf24"
        />
      </div>

      {/* 3. Visual Charts Section: Radar Chart + Amenity Distribution Bar Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
              Multi-Axis Livability Balance
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              4-dimensional footprint across civic, environmental, scout, and transit axes
            </p>
          </div>
          <div className="py-4">
            <RadarChart scores={scores} />
          </div>
          <div className="text-[11px] text-slate-500 text-center border-t border-slate-800/80 pt-3">
            Balanced diamond indicates uniform infrastructure &amp; climate resilience
          </div>
        </div>

        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between space-y-4">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
              Civic Amenity Distribution Chart ({radiusKm} km)
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Proportional density of verified OpenStreetMap nodes within range
            </p>
          </div>

          <div className="space-y-3.5 my-auto">
            {amenityBars.map((bar) => {
              const widthPct = Math.max(6, Math.round((bar.count / maxAmenityCount) * 100));
              return (
                <div key={bar.label} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300 font-medium">{bar.label}</span>
                    <span className="font-mono font-bold text-white">{bar.count}</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${bar.color}`}
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-800/80 text-center text-xs">
            <div className="bg-slate-950 py-2 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-[10px]">Temples</span>
              <span className="font-bold text-slate-200">{amenities.temples}</span>
            </div>
            <div className="bg-slate-950 py-2 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-[10px]">Mosques</span>
              <span className="font-bold text-slate-200">{amenities.mosques}</span>
            </div>
            <div className="bg-slate-950 py-2 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-[10px]">Churches</span>
              <span className="font-bold text-slate-200">{amenities.churches}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Complete 10-Metric Civic & Environmental Counter Grid */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
          Granular Infrastructure &amp; Hazard Census
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: "Schools", value: amenities.schools, tone: "text-white" },
            { label: "Hospitals / Clinics", value: amenities.hospitals, tone: "text-white" },
            { label: "Grocery & Markets", value: amenities.groceryAndMarkets, tone: "text-white" },
            { label: "Chemist Shops", value: amenities.chemistShops, tone: "text-white" },
            { label: "Metro Stations", value: amenities.metroStations, tone: "text-sky-400" },
            { label: "Temples", value: amenities.temples, tone: "text-white" },
            { label: "Mosques", value: amenities.mosques, tone: "text-white" },
            { label: "Churches", value: amenities.churches, tone: "text-white" },
            {
              label: "Hidden / Open Dumps",
              value: amenities.openDumps,
              tone: amenities.openDumps > 0 ? "text-red-400" : "text-emerald-400",
            },
            {
              label: "Sewage Canals / Drains",
              value: amenities.sewageCanals,
              tone: amenities.sewageCanals > 0 ? "text-amber-400" : "text-emerald-400",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="p-3.5 bg-slate-950 rounded-xl border border-slate-800/90 flex flex-col justify-between"
            >
              <span className="text-[11px] text-slate-400">{item.label}</span>
              <span className={`text-2xl font-extrabold font-mono mt-1 ${item.tone}`}>
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 5. Walkability Matrix + Monsoon & Climate Reality */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
                Real-World Walking Distance to Civic Amenities &amp; Main Road
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Adjusted for {climate.temperature}°C temperature, footpath winding (1.28x), and drain/dump detours
              </p>
            </div>
            <span className="text-xs font-mono bg-slate-950 border border-slate-800 px-3 py-1 rounded-lg text-sky-400 shrink-0">
              Pace: {walkability.effectiveSpeedKmH} km/h (-{walkability.obstaclePenaltyPercent}% drag)
            </span>
          </div>

          <div className="divide-y divide-slate-800/70 text-xs">
            {walkability.items.map((w) => (
              <div key={w.label} className="py-3 flex items-center justify-between gap-4">
                <span className="text-slate-200 font-medium">{w.label}</span>
                {w.distanceMeters !== null ? (
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-slate-400">{w.distanceMeters} m</span>
                    <span className="font-mono font-bold text-sky-400 w-16 text-right">
                      ~{w.walkingMinutes} min
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        w.effortLevel === "Easy"
                          ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                          : w.effortLevel === "Moderate"
                          ? "bg-amber-950 text-amber-400 border border-amber-800"
                          : "bg-rose-950 text-rose-400 border border-rose-800"
                      }`}
                    >
                      {w.effortLevel}
                    </span>
                  </div>
                ) : (
                  <span className="text-slate-500 italic">None within {radiusKm} km</span>
                )}
              </div>
            ))}
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400">
            <strong className="text-slate-200">Active Impedance Factor:</strong> {walkability.impedanceSummary}
          </div>
        </div>

        {/* Climate, Monsoon & Air Quality Card */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
              Atmospheric &amp; Monsoon Vulnerability
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-[11px] text-slate-400 block">General Temperature</span>
                <span className="text-xl font-bold text-white mt-1 block">{climate.temperature}°C</span>
                <span className="text-[10px] text-slate-500">Humidity: {climate.humidity}%</span>
              </div>
              <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-[11px] text-slate-400 block">Air Quality (US AQI)</span>
                <span className="text-xl font-bold text-teal-400 mt-1 block">{airQuality.aqi}</span>
                <span className="text-[10px] text-slate-500">{airQuality.category}</span>
              </div>
            </div>

            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Monsoon Vulnerability</span>
                <span
                  className={`font-bold ${
                    climate.isMonsoonRisk ? "text-red-400" : "text-emerald-400"
                  }`}
                >
                  {climate.monsoonRiskLevel}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Particulate Matter (PM2.5 / PM10)</span>
                <span className="font-mono text-slate-200">
                  {airQuality.pm25} / {airQuality.pm10} µg/m³
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Surface Drainage Canals</span>
                <span className="font-mono text-slate-200">{amenities.sewageCanals} mapped</span>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 leading-relaxed">
            Monsoon vulnerability combines daily precipitation telemetry with localized open canal/drain proximity to estimate low-lying waterlogging risk.
          </p>
        </div>
      </div>

      {/* 6. Civic Qualitative Intelligence Grid (6 Deep-Dive Cards) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { title: "Schooling Quality", data: qualitative.schoolingQuality },
          { title: "Crime & Safety Statistics", data: qualitative.crimeStatistics },
          { title: "Water Availability", data: qualitative.waterAvailability },
          { title: "Power Outage Frequency", data: qualitative.powerOutageFrequency },
          { title: "Future Infrastructure Plans", data: qualitative.futureInfrastructurePlans },
          { title: "Dump Waste & Sewage Canals", data: qualitative.wasteAndSewage },
        ].map((card) => (
          <div
            key={card.title}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2 flex flex-col justify-between"
          >
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {card.title}
                </h4>
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-sky-950/70 text-sky-400 border border-sky-800/60">
                  {card.data.rating}
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed pt-1">{card.data.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}