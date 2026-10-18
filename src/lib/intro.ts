/**
 * Preloader → page handshake. The preloader calls `signalIntroReveal()` as its curtain starts
 * lifting (or immediately when the intro is skipped); anything that animates on arrival — the
 * hero headline, the particle field — waits for it via `onIntroReveal()`.
 */
const REVEAL_EVENT = "site:intro-reveal";

function revealed() {
  return document.documentElement.dataset.introRevealed === "true";
}

export function signalIntroReveal() {
  if (revealed()) return;
  document.documentElement.dataset.introRevealed = "true";
  window.dispatchEvent(new Event(REVEAL_EVENT));
}

/** Runs `callback` once the intro reveals (immediately if it already has). Returns an unsubscribe. */
export function onIntroReveal(callback: () => void) {
  if (revealed()) {
    callback();
    return () => {};
  }
  window.addEventListener(REVEAL_EVENT, callback, { once: true });
  return () => window.removeEventListener(REVEAL_EVENT, callback);
}

/** Contract with scripts/qa.mjs: `<html data-ready="true">` once the intro has fully finished. */
export function markReady() {
  document.documentElement.dataset.ready = "true";
}
