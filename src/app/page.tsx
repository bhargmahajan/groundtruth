"use client";

import { useCallback, useState } from "react";
import LocationInput, { DEFAULT_BANGALORE, type LocationData } from "@/components/LocationInput";
import type { AmenityCounts, NeighborhoodReport, ScoreMetric } from "@/lib/report-types";

const amenityLabels: Record<keyof AmenityCounts, string> = {
  schools: "Schools",
  hospitals: "Hospitals",
  clinicsAndDoctors: "Clinics & doctors",
  groceries: "Grocery shops",
  markets: "Markets",
  chemists: "Chemists",
  metroStations: "Metro stations",
  metroEntrances: "Metro entrances",
  temples: "Temples",
  mosques: "Mosques",
  churches: "Churches",
  otherPlacesOfWorship: "Other worship",
  mappedWasteSites: "Mapped waste sites",
  mappedDrainageFeatures: "Mapped drains & canals",
};

function ScoreCard({ title, metric, color }: { title: string; metric: ScoreMetric; color: string }) {
  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg shadow-black/10">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-medium text-slate-300">{title}</h3>
        <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] uppercase tracking-wider text-slate-500">
          proxy
        </span>
      </div>
      <p className="mt-4 text-4xl font-semibold tracking-tight text-white">
        {metric.value === null ? "—" : metric.value}
        {metric.value !== null && <span className="ml-1 text-sm font-normal text-slate-500">/100</span>}
      </p>
      <div
        className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800"
        role="progressbar"
        aria-label={`${title} score`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={metric.value ?? undefined}
      >
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${metric.value ?? 0}%` }}
        />
      </div>
      <p className="mt-3 text-xs leading-relaxed text-slate-500">{metric.basis}</p>
    </article>
  );
}

function DashboardSection({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4" aria-label={title}>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-400">{eyebrow}</p>
        <h3 className="mt-1 text-lg font-semibold text-white">{title}</h3>
        {description && <p className="mt-1 text-sm text-slate-400">{description}</p>}
      </div>
      {children}
    </section>
  );
}

export default function HomePage() {
  const [location, setLocation] = useState<LocationData>(DEFAULT_BANGALORE);
  const [locationQuery, setLocationQuery] = useState(DEFAULT_BANGALORE.label);
  const [range, setRange] = useState(1);
  const [report, setReport] = useState<NeighborhoodReport | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const handleLocationChange = useCallback((newLocation: LocationData) => {
    setLocation(newLocation);
    setLocationQuery(newLocation.label);
    setReport(null);
  }, []);
  const handleLocationQueryChange = useCallback((query: string) => {
    setLocationQuery(query);
    setReport(null);
    setReportError(null);
  }, []);

  const generateReport = async () => {
    if (locationQuery.trim() !== location.label) {
      setReportError("Select a location suggestion or enter valid coordinates before generating the report.");
      return;
    }
    setIsGenerating(true);
    setReportError(null);
    try {
      const response = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location, radiusKm: range }),
      });
      const result = (await response.json()) as {
        report?: NeighborhoodReport;
        error?: string;
      };
      if (!response.ok || !result.report) {
        throw new Error(result.error ?? "The report could not be generated.");
      }
      setReport(result.report);
    } catch (error) {
      setReportError(
        error instanceof Error ? error.message : "The report could not be generated.",
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const amenityEntries = report?.amenities
    ? (Object.entries(report.amenities) as Array<[keyof AmenityCounts, number]>)
    : [];
  const maxAmenityCount = Math.max(1, ...amenityEntries.map(([, count]) => count));

  return (
    <main className="min-h-screen bg-[#080d18] px-4 py-8 text-slate-100 sm:px-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">
              GroundTruth · Neighbourhood intelligence
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Local area report
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Explore civic access, local conditions, and service availability.
            </p>
          </div>
          {report && (
            <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-400">
              Updated {new Date(report.generatedAt).toLocaleString()}
            </span>
          )}
        </header>

        <section
          aria-label="Report location and range"
          className="grid gap-6 rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl shadow-black/20 lg:grid-cols-[1fr_280px]"
        >
          <LocationInput
            value={location}
            onChange={handleLocationChange}
            onQueryChange={handleLocationQueryChange}
          />
          <div className="flex flex-col justify-end gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="search-range"
                  className="text-xs font-semibold uppercase tracking-wider text-slate-400"
                >
                  Search radius
                </label>
                <output htmlFor="search-range" className="text-sm font-semibold text-sky-400">
                  {range.toFixed(1)} km
                </output>
              </div>
              <input
                id="search-range"
                type="range"
                min="0.5"
                max="5"
                step="0.5"
                value={range}
                onChange={(event) => {
                  setRange(Number(event.target.value));
                  setReport(null);
                  setReportError(null);
                }}
                aria-valuetext={`${range.toFixed(1)} kilometers`}
                className="w-full cursor-pointer accent-sky-500"
              />
              <div className="flex justify-between text-xs text-slate-500">
                <span>0.5 km</span>
                <span>5 km</span>
              </div>
            </div>
            <button
              type="button"
              onClick={generateReport}
              disabled={isGenerating}
              className="w-full rounded-xl bg-sky-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-wait disabled:opacity-60"
            >
              {isGenerating ? "Generating report…" : "Generate report"}
            </button>
            {reportError && (
              <p role="alert" className="text-sm text-red-400">
                {reportError}
              </p>
            )}
          </div>
        </section>

        {report && (
          <div className="space-y-8">
            <section
              aria-labelledby="report-title"
              className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-900/60 p-6"
            >
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                  Report area
                </p>
                <h2 id="report-title" className="mt-1 text-2xl font-semibold text-white">
                  {report.location.label}
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  {report.location.lat.toFixed(4)}, {report.location.lng.toFixed(4)} ·{" "}
                  {report.location.radiusKm.toFixed(1)} km radius
                </p>
              </div>
              <p className="max-w-sm text-xs leading-relaxed text-slate-500">
                Scores are transparent, unofficial indicators based only on the available data.
                Missing information is shown as unavailable, never as zero.
              </p>
            </section>

            <DashboardSection
              eyebrow="At a glance"
              title="Neighbourhood scores"
              description="An at-a-glance comparison of the available report indicators. These are proxies, not official ratings."
            >
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <ScoreCard
                  title="Civic infrastructure"
                  metric={report.scores.civicInfrastructure}
                  color="bg-sky-400"
                />
                <ScoreCard
                  title="Environmental"
                  metric={report.scores.environmental}
                  color="bg-emerald-400"
                />
                <ScoreCard
                  title="Neighbourhood scout"
                  metric={report.scores.neighbourhoodScout}
                  color="bg-violet-400"
                />
                <ScoreCard
                  title="Commute reality"
                  metric={report.scores.commuteReality}
                  color="bg-amber-400"
                />
              </div>
            </DashboardSection>

            <DashboardSection
              eyebrow="Everyday access"
              title="Civic amenities"
              description="Mapped places inside the selected radius. Counts reflect OpenStreetMap tagging and may be incomplete."
            >
              <article className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
                {report.amenities ? (
                  <div className="grid gap-x-8 gap-y-4 md:grid-cols-2">
                    {amenityEntries.map(([key, count]) => (
                      <div key={key} className="space-y-1.5">
                        <div className="flex justify-between gap-4 text-sm">
                          <span className="text-slate-300">{amenityLabels[key]}</span>
                          <span className="font-medium tabular-nums text-white">{count}</span>
                        </div>
                        <div
                          className="h-1.5 overflow-hidden rounded-full bg-slate-800"
                          role="img"
                          aria-label={`${amenityLabels[key]}: ${count} mapped`}
                        >
                          <div
                            className="h-full rounded-full bg-sky-500"
                            style={{ width: `${(count / maxAmenityCount) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-xl border border-amber-900/60 bg-amber-950/20 p-4 text-sm text-amber-200">
                    Map data is currently unavailable. Amenity counts are not assumed to be zero.
                  </p>
                )}
              </article>
            </DashboardSection>

            <DashboardSection
              eyebrow="Digital services"
              title="App availability"
              description="Coverage can depend on the exact address, time, inventory, and account."
            >
              <div className="grid gap-4 md:grid-cols-3">
                {report.digitalServices.map((service, index) => (
                  <article
                    key={service.category}
                    className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs text-slate-500">0{index + 1} · Service category</p>
                        <h4 className="mt-1 font-semibold text-white">{service.category}</h4>
                      </div>
                      <span className="rounded-full border border-amber-800/70 bg-amber-950/40 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-amber-300">
                        Not verified
                      </span>
                    </div>
                    <p className="mt-4 text-sm leading-relaxed text-slate-400">
                      {service.details}
                    </p>
                  </article>
                ))}
              </div>
            </DashboardSection>

            <DashboardSection
              eyebrow="Local conditions"
              title="Environment & weather"
              description="Current modeled conditions for the report coordinates; these are not local sensor readings."
            >
              <div className="grid gap-4 lg:grid-cols-2">
                <article className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
                  <p className="text-sm font-medium text-slate-300">Temperature & precipitation</p>
                  {report.weather ? (
                    <div className="mt-5 grid grid-cols-2 gap-4">
                      {[
                        ["Temperature", report.weather.temperatureC, "°C"],
                        ["Feels like", report.weather.feelsLikeC, "°C"],
                        ["Current precipitation", report.weather.precipitationMm, "mm"],
                        ["7-day forecast rain", report.weather.sevenDayRainfallMm, "mm"],
                      ].map(([label, value, unit]) => (
                        <div key={String(label)} className="rounded-xl bg-slate-950/70 p-4">
                          <p className="text-xs text-slate-500">{label}</p>
                          <p className="mt-2 text-2xl font-semibold tabular-nums text-white">
                            {value ?? "—"}
                            <span className="ml-1 text-sm font-normal text-slate-500">{unit}</span>
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-amber-300">Weather data is unavailable.</p>
                  )}
                </article>
                <article className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-slate-300">Air quality (modeled)</p>
                      <p className="mt-1 text-xs text-slate-500">US AQI scale · 0–500</p>
                    </div>
                    <p className="text-3xl font-semibold tabular-nums text-white">
                      {report.airQuality?.usAqi ?? "—"}
                    </p>
                  </div>
                  <div
                    className="mt-6 h-2 overflow-hidden rounded-full bg-gradient-to-r from-emerald-400 via-yellow-400 via-orange-400 to-red-500"
                    role="img"
                    aria-label={
                      report.airQuality?.usAqi == null
                        ? "Air quality index unavailable"
                        : `US air quality index ${report.airQuality.usAqi} out of 500`
                    }
                  >
                    {report.airQuality?.usAqi != null && (
                      <div
                        className="relative h-full"
                        style={{ width: `${Math.max(1, (report.airQuality.usAqi / 500) * 100)}%` }}
                      >
                        <span className="absolute right-0 top-1/2 h-4 w-1 -translate-y-1/2 rounded bg-white shadow" />
                      </div>
                    )}
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                    <p className="rounded-xl bg-slate-950/70 p-3 text-slate-400">
                      European AQI
                      <strong className="mt-1 block text-lg text-white">
                        {report.airQuality?.europeanAqi ?? "—"}
                      </strong>
                    </p>
                    <p className="rounded-xl bg-slate-950/70 p-3 text-slate-400">
                      PM2.5
                      <strong className="mt-1 block text-lg text-white">
                        {report.airQuality?.pm25 ?? "—"} <span className="text-xs font-normal">µg/m³</span>
                      </strong>
                    </p>
                  </div>
                  <p className="mt-4 text-xs leading-relaxed text-slate-500">
                    Modeled estimates via Open-Meteo; not measurements from a local ground sensor.
                  </p>
                </article>
              </div>
            </DashboardSection>

            <DashboardSection
              eyebrow="On foot"
              title="Walking access"
              description="Walking-network routes where available. Typical route duration is not adjusted for weather, heat, or unrecorded obstacles."
            >
              <article className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
                {report.walkingRoutes.length > 0 ? (
                  <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {report.walkingRoutes.map((route) => (
                      <li
                        key={route.category}
                        className="rounded-xl border border-slate-800 bg-slate-950/70 p-4"
                      >
                        <p className="text-xs capitalize text-slate-500">Best routed {route.category}</p>
                        <p className="mt-1 truncate font-medium text-white">{route.name}</p>
                        <p className="mt-3 text-lg font-semibold text-sky-300">
                          {route.distanceKm.toFixed(2)} km
                          <span className="ml-2 text-sm font-normal text-slate-500">
                            · {route.typicalMinutes} min
                          </span>
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-amber-300">Walking routes are unavailable.</p>
                )}
                <p className="mt-4 border-t border-slate-800 pt-4 text-sm text-slate-300">
                  Nearest mapped main road:{" "}
                  {report.nearestMainRoad
                    ? `${report.nearestMainRoad.name}, ${report.nearestMainRoad.distanceKm.toFixed(2)} km walking`
                    : "unavailable"}
                </p>
              </article>
            </DashboardSection>

            <DashboardSection
              eyebrow="Methodology"
              title="Data quality & sources"
              description="Review the limitations and data-provider status before relying on this report."
            >
              <div className="grid gap-4 lg:grid-cols-2">
                <article className="rounded-2xl border border-amber-900/60 bg-amber-950/20 p-5">
                  <h4 className="font-semibold text-amber-200">Important data gaps</h4>
                  <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-300">
                    {report.dataGaps.map((gap) => <li key={gap}>{gap}</li>)}
                  </ul>
                </article>
                <article className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
                  <h4 className="font-semibold text-white">Sources & status</h4>
                  <ul className="mt-3 space-y-4">
                    {report.sources.map((source) => (
                      <li key={source.name} className="border-b border-slate-800 pb-3 last:border-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm font-medium text-sky-400 underline underline-offset-2"
                          >
                            {source.name}
                          </a>
                          <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] uppercase tracking-wider text-slate-400">
                            {source.status}
                          </span>
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-slate-500">{source.details}</p>
                      </li>
                    ))}
                  </ul>
                </article>
              </div>
            </DashboardSection>
          </div>
        )}
      </div>
    </main>
  );
}
