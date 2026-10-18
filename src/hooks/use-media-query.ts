"use client";

import { useCallback, useSyncExternalStore } from "react";

export function useMediaQuery(query: string, serverFallback = false) {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const media = window.matchMedia(query);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => serverFallback,
  );
}

export const useReducedMotion = () => useMediaQuery("(prefers-reduced-motion: reduce)");

/** A real mouse/trackpad — the custom cursor and magnetic effects only run here. */
export const useFinePointer = () => useMediaQuery("(hover: hover) and (pointer: fine)");
