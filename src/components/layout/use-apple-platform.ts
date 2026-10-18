"use client";

import { useSyncExternalStore } from "react";

const subscribeNever = () => () => {};

/**
 * ⌘ on Apple platforms, Ctrl elsewhere. The server (and hydration) assume Apple. Lives apart from
 * the palette so the header can label its shortcut without pulling cmdk into first-load JS.
 */
export function useIsApplePlatform() {
  return useSyncExternalStore(
    subscribeNever,
    () => /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent),
    () => true,
  );
}
