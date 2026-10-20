// src/components/RangeInput.tsx
"use client";

import React from "react";

interface RangeInputProps {
  radiusKm: number;
  onChange: (newRadius: number) => void;
}

export default function RangeInput({ radiusKm, onChange }: RangeInputProps) {
  return (
    <div className="w-full space-y-2">
      <div className="flex items-center justify-between">
        <label
          htmlFor="distance-slider"
          className="block text-xs font-semibold uppercase tracking-wider text-slate-400"
        >
          Distance Range Scope
        </label>
        <span className="text-xs font-bold text-sky-400 font-mono bg-sky-950/60 px-2.5 py-1 rounded-full border border-sky-800/60">
          {radiusKm} km
        </span>
      </div>

      <div className="relative flex items-center pt-1">
        <input
          id="distance-slider"
          type="range"
          min="0.5"
          max="5"
          step="0.5"
          value={radiusKm}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-full h-2 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-sky-500 border border-slate-800"
        />
      </div>

      <div className="flex justify-between text-[11px] text-slate-500 px-1 font-mono">
        <span>0.5 km</span>
        <span className="text-slate-400 font-semibold">1 km (Default)</span>
        <span>5.0 km</span>
      </div>
    </div>
  );
}