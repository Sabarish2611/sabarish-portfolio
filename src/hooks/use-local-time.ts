"use client";

import { useMemo, useSyncExternalStore } from "react";

function subscribe(onTick: () => void) {
  const id = window.setInterval(onTick, 1000);
  return () => window.clearInterval(id);
}

/**
 * Live "HH:MM" wall-clock time in `timeZone`. Renders `null` on the server and during
 * prerender (no Date access outside the browser), then ticks on the client.
 */
export function useLocalTime(timeZone: string): string | null {
  const format = useMemo(
    () =>
      new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
        timeZone,
      }),
    [timeZone],
  );
  return useSyncExternalStore(
    subscribe,
    () => format.format(Date.now()),
    () => null,
  );
}
