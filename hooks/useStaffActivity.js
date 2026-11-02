"use client";

import { useEffect, useState } from "react";

const REFRESH_MS = 15000;

// Polls /api/staff/activity so staff and admin pages show RFID check-ins and
// machine/room usage as they happen. Pauses while the tab is hidden.
export function useStaffActivity() {
  const [activity, setActivity] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;
    let timer;

    const schedule = () => {
      clearTimeout(timer);
      if (!cancelled) timer = setTimeout(load, REFRESH_MS);
    };

    async function load() {
      if (inFlight) return;
      if (document.hidden) return schedule();
      inFlight = true;
      try {
        const response = await fetch("/api/staff/activity");
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not load activity.");
        if (!cancelled) {
          setActivity(result);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err.message || "Could not load activity.");
      } finally {
        inFlight = false;
        schedule();
      }
    }

    const onVisibilityChange = () => {
      if (!document.hidden) load();
    };

    load();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return { activity, error };
}
