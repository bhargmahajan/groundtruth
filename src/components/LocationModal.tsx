"use client";

import React, { useState, useEffect } from "react";

interface LocationState {
  coords: { lat: number; lng: number };
  label: string;
  isReady: boolean;
}

const BANGALORE_DEFAULT = { lat: 12.9716, lng: 77.5946, label: "Bengaluru, Karnataka" };

export default function LocationModal({
  onLocationResolved,
}: {
  onLocationResolved: (location: LocationState) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<string>("prompt");

  useEffect(() => {
    if (!navigator.permissions || !navigator.geolocation) {
      onLocationResolved({ coords: BANGALORE_DEFAULT, label: BANGALORE_DEFAULT.label, isReady: true });
      return;
    }

    navigator.permissions.query({ name: "geolocation" }).then((status) => {
      setPermissionStatus(status.state);
      if (status.state === "granted") {
        fetchCurrentLocation();
      } else {
        setIsOpen(true);
      }

      status.onchange = () => {
        setPermissionStatus(status.state);
        if (status.state === "granted") {
          fetchCurrentLocation();
          setIsOpen(false);
        }
      };
    });
  }, []);

  const fetchCurrentLocation = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onLocationResolved({
          coords: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          label: "Current GPS Location",
          isReady: true,
        });
        setIsOpen(false);
      },
      () => {
        // Fallback on error or explicit deny
        onLocationResolved({ coords: BANGALORE_DEFAULT, label: BANGALORE_DEFAULT.label, isReady: true });
        setIsOpen(false);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-slate-100">
        <h2 className="text-xl font-semibold tracking-tight text-white mb-2">Location Access Required</h2>
        <p className="text-sm text-slate-400 mb-6">
          To generate accurate local neighbourhood and civic scores, GroundTruth needs access to your physical location.
        </p>

        <div className="flex flex-col gap-3">
          <button
            onClick={fetchCurrentLocation}
            className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 font-medium text-white transition active:scale-[0.98]"
          >
            Allow Location Access
          </button>
          <button
            onClick={() => {
              onLocationResolved({ coords: BANGALORE_DEFAULT, label: BANGALORE_DEFAULT.label, isReady: true });
              setIsOpen(false);
            }}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 font-medium text-slate-300 transition"
          >
            Continue with Bengaluru (Default)
          </button>
        </div>
      </div>
    </div>
  );
}