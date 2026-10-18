"use client";

import { MotionConfig } from "motion/react";
import { useEffect, type ReactNode } from "react";
import { STORAGE_KEYS } from "@/lib/preferences";
import { SmoothScroll } from "./smooth-scroll";

export function Providers({ children }: { children: ReactNode }) {
  // When an error makes React re-render the whole document on the client, the inline head script
  // never runs (no data-js) — re-apply the visitor's stored theme and accent ourselves.
  useEffect(() => {
    const root = document.documentElement;
    if ("js" in root.dataset) return;
    try {
      const theme = localStorage.getItem(STORAGE_KEYS.theme);
      const accent = localStorage.getItem(STORAGE_KEYS.accent);
      if (theme === "light" || theme === "dark") root.dataset.theme = theme;
      if (accent === "lime" || accent === "orange") root.dataset.accent = accent;
    } catch {}
  }, []);

  return (
    // Motion ignores prefers-reduced-motion unless told to ("never" is its default).
    <MotionConfig reducedMotion="user">
      <SmoothScroll>{children}</SmoothScroll>
    </MotionConfig>
  );
}
