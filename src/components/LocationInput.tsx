// src/components/LocationInput.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";

// Dynamically import Leaflet Map with SSR disabled to prevent server hydration errors
const InteractiveMap = dynamic(() => import("@/components/InteractiveMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[320px] rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-xs text-slate-400 animate-pulse">
      Loading Interactive Map...
    </div>
  ),
});

export interface LocationData {
  label: string;
  lat: number;
  lng: number;
}

export const DEFAULT_BANGALORE: LocationData = {
  label: "Bangalore",
  lat: 12.9716,
  lng: 77.5946,
};

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

interface LocationInputProps {
  value: LocationData;
  onChange: (newLocation: LocationData) => void;
  onQueryChange?: (query: string) => void;
}

export default function LocationInput({ value, onChange, onQueryChange }: LocationInputProps) {
  const [inputText, setInputText] = useState<string>(value.label);
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [showDropdown, setShowDropdown] = useState<boolean>(false);
  const [showMapModal, setShowMapModal] = useState<boolean>(true);
  const [isLocatingGps, setIsLocatingGps] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const skipNextSearchRef = useRef<boolean>(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Forward geocoding search as user types
  useEffect(() => {
    if (skipNextSearchRef.current) {
      skipNextSearchRef.current = false;
      return;
    }

    const trimmed = inputText.trim();
    if (!trimmed || trimmed.length < 3 || trimmed === value.label) {
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(trimmed)}&limit=5&addressdetails=1`,
          { headers: { "Accept-Language": "en" }, signal: controller.signal }
        );
        const data: NominatimResult[] = await res.json();
        setSuggestions(data);
        setShowDropdown(data.length > 0);
      } catch (err) {
        if (!controller.signal.aborted) {
          console.warn("[LocationInput] Autocomplete search failed:", err);
        }
      }
    }, 400);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [inputText, value.label, onChange]);

  const handleSelectSuggestion = (item: NominatimResult) => {
    const shortLabel = item.display_name.split(",").slice(0, 3).join(",").trim();
    const newLoc: LocationData = {
      label: shortLabel,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
    };

    skipNextSearchRef.current = true;
    setInputText(shortLabel);
    onQueryChange?.(shortLabel);
    setSuggestions([]);
    setShowDropdown(false);
    setStatusMessage(`Location set to ${shortLabel}`);
    onChange(newLoc);
  };

  // Reverse geocode when clicking on the map
  const handleMapClick = async (lat: number, lng: number) => {
    setStatusMessage("Reverse geocoding map location...");
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14`,
        { headers: { "Accept-Language": "en" } }
      );
      const data = await res.json();
      const area = data.address?.suburb || data.address?.neighbourhood || data.address?.town || "";
      const city = data.address?.city || data.address?.state_district || "";
      const readableLabel = area && city ? `${area}, ${city}` : (city || `${lat.toFixed(4)}, ${lng.toFixed(4)}`);

      skipNextSearchRef.current = true;
      setInputText(readableLabel);
      onQueryChange?.(readableLabel);
      onChange({ label: readableLabel, lat, lng });
      setStatusMessage(`Location updated from map pin.`);
    } catch {
      const fallbackLabel = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      setInputText(fallbackLabel);
      onQueryChange?.(fallbackLabel);
      onChange({ label: fallbackLabel, lat, lng });
      setStatusMessage("Location updated from map pin.");
    }
  };

  const handleGpsClick = async () => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setStatusMessage("Geolocation is not supported by your browser.");
      return;
    }

    setIsLocatingGps(true);
    setShowDropdown(false);
    setStatusMessage("Fetching GPS location...");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14`,
            { headers: { "Accept-Language": "en" } }
          );
          const data = await res.json();
          const area = data.address?.suburb || data.address?.neighbourhood || "";
          const city = data.address?.city || data.address?.state_district || "";
          const readableLabel = area && city ? `${area}, ${city}` : (city || "Current Location");

          skipNextSearchRef.current = true;
          setInputText(readableLabel);
          onQueryChange?.(readableLabel);
          onChange({ label: readableLabel, lat, lng });
        } catch {
          const fallbackLabel = "Current GPS Location";
          setInputText(fallbackLabel);
          onQueryChange?.(fallbackLabel);
          onChange({ label: fallbackLabel, lat, lng });
        }

        setStatusMessage("Updated to current GPS location.");
        setIsLocatingGps(false);
      },
      () => {
        setStatusMessage("GPS access denied or unavailable.");
        setIsLocatingGps(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const handleInputChange = (text: string) => {
    setInputText(text);
    setSuggestions([]);
    setShowDropdown(false);
    onQueryChange?.(text);
    setStatusMessage(null);

    const trimmed = text.trim();
    const coordMatch = trimmed.match(/^(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)$/);
    if (!coordMatch) return;

    const lat = Number(coordMatch[1]);
    const lng = Number(coordMatch[3]);
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return;

    onChange({ label: trimmed, lat, lng });
    setStatusMessage("Custom coordinates applied.");
  };

  return (
    <div ref={containerRef} className="w-full space-y-3 relative">
      <div className="flex items-center justify-between">
        <label
          htmlFor="location-input"
          className="block text-xs font-semibold uppercase tracking-wider text-slate-400"
        >
          Target Location
        </label>
        <button
          type="button"
          onClick={() => setShowMapModal(!showMapModal)}
          className="text-xs font-medium text-sky-400 hover:text-sky-300 flex items-center gap-1 transition cursor-pointer"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
            <line x1="8" y1="2" x2="8" y2="18" />
            <line x1="16" y1="6" x2="16" y2="22" />
          </svg>
          {showMapModal ? "Hide Map Picker" : "Pick on Map"}
        </button>
      </div>

      <div className="relative flex items-center">
        <input
          id="location-input"
          type="text"
          value={inputText}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => {
            if (suggestions.length > 0) setShowDropdown(true);
          }}
          placeholder="Type any city, area, or click map..."
          autoComplete="off"
          className="w-full rounded-xl bg-slate-950 border border-slate-800 pl-4 pr-20 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition"
        />

        {/* GPS Button */}
        <button
          type="button"
          onClick={handleGpsClick}
          disabled={isLocatingGps}
          title="Use current GPS location"
          className="absolute right-2 p-2 rounded-lg text-slate-400 hover:text-sky-400 hover:bg-slate-900 active:scale-95 transition cursor-pointer"
        >
          {isLocatingGps ? (
            <svg className="w-5 h-5 animate-spin text-sky-400" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="7" />
              <circle cx="12" cy="12" r="2" />
              <line x1="12" y1="2" x2="12" y2="5" />
              <line x1="12" y1="19" x2="12" y2="22" />
              <line x1="2" y1="12" x2="5" y2="12" />
              <line x1="19" y1="12" x2="22" y2="12" />
            </svg>
          )}
        </button>
      </div>

      {/* Interactive Map Picker Toggle Drawer */}
      {showMapModal && (
        <div className="space-y-2 pt-1 animate-in fade-in duration-200">
          <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
            <span>Click anywhere on the map to drop pin &amp; update location</span>
            <span className="text-sky-400 font-mono">
              {value.lat.toFixed(4)}, {value.lng.toFixed(4)}
            </span>
          </div>
          <InteractiveMap lat={value.lat} lng={value.lng} onLocationSelect={handleMapClick} />
        </div>
      )}

      {/* Autocomplete Dropdown */}
      {showDropdown && suggestions.length > 0 && (
        <ul className="absolute z-30 left-0 right-0 mt-1 max-h-60 overflow-auto rounded-xl bg-slate-900 border border-slate-700 shadow-2xl divide-y divide-slate-800/80">
          {suggestions.map((item) => (
            <li key={item.place_id}>
              <button
                type="button"
                onClick={() => handleSelectSuggestion(item)}
                className="w-full text-left px-4 py-2.5 text-xs text-slate-200 hover:bg-slate-800 hover:text-sky-400 transition cursor-pointer"
              >
                <span className="font-semibold text-sm truncate block">{item.display_name.split(",")[0]}</span>
                <span className="text-slate-400 truncate text-[11px] block">{item.display_name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Status Bar */}
      <div className="flex items-center justify-between text-xs text-slate-500 px-1">
        <span>Active: <strong className="text-slate-300">{value.label}</strong></span>
        {statusMessage && <span className="text-sky-400 font-medium">{statusMessage}</span>}
      </div>
    </div>
  );
}