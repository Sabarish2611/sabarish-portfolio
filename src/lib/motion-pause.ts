/**
 * Pause preference for looping motion (WCAG 2.2.2): one choice, set with the marquee's control and
 * followed by every animation that loops on its own (the marquee rows, the hero map's drift),
 * remembered across visits.
 */

/** Named for the marquee, which had it first: renaming it would forget choices already saved. */
const PAUSE_KEY = "marquee-paused";
const listeners = new Set<() => void>();
let choice: boolean | null = null;

export function readPaused() {
  if (choice === null) {
    try {
      choice = localStorage.getItem(PAUSE_KEY) === "1";
    } catch {
      choice = false;
    }
  }
  return choice;
}

export function writePaused(paused: boolean) {
  choice = paused; // still works for this visit when storage is unavailable
  try {
    localStorage.setItem(PAUSE_KEY, paused ? "1" : "0");
  } catch {}
  listeners.forEach((listener) => listener());
}

export function subscribePaused(listener: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== PAUSE_KEY) return;
    choice = null; // changed in another tab
    listener();
  };
  listeners.add(listener);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}
