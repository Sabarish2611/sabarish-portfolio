"use client";

import { useSyncExternalStore } from "react";
import { DEFAULT_ACCENT, DEFAULT_THEME, type Accent, type Theme } from "@/lib/preferences";

// The <html> data attributes are the single source of truth (set before paint by
// PREFERENCES_SCRIPT, changed by setTheme/setAccent); React just observes them.
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme", "data-accent"],
  });
  return () => observer.disconnect();
}

export function useTheme(): Theme {
  return useSyncExternalStore(
    subscribe,
    () => (document.documentElement.dataset.theme === "light" ? "light" : "dark"),
    () => DEFAULT_THEME,
  );
}

export function useAccent(): Accent {
  return useSyncExternalStore(
    subscribe,
    () => (document.documentElement.dataset.accent === "orange" ? "orange" : "lime"),
    () => DEFAULT_ACCENT,
  );
}
