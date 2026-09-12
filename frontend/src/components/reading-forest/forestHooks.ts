import { useEffect, useMemo, useState } from "react";
import type { ForestPeriod, ForestThemeMode } from "./types";

export function resolveForestPeriod(mode: ForestThemeMode, date = new Date()): ForestPeriod {
  if (mode !== "auto") return mode;
  const hour = date.getHours();
  return hour >= 19 || hour < 4 ? "night" : "day";
}

export function useResolvedForestPeriod(mode: ForestThemeMode) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (mode !== "auto") return;
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, [mode]);
  return useMemo(() => resolveForestPeriod(mode, now), [mode, now]);
}

export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}

