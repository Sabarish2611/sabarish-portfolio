import { EASE, gsap } from "@/lib/gsap";

/**
 * Highlighter wipe for `.hl` phrases (styles in globals.css): a solid accent bar sweeps across the
 * phrase left to right, the translucent marker is laid under it, and the bar retracts to the right,
 * leaving the marker. Call `hideHighlights` as soon as the phrases exist (so the marker isn't seen
 * before its wipe), then add the returned timeline wherever the reveal should play it.
 */
export function hideHighlights(targets: readonly Element[]) {
  const pieces = withText(targets);
  if (pieces.length === 0) return; // most reveals have none; GSAP warns about empty targets
  gsap.set(pieces, { "--hl-mark": 0, "--hl-bar": 0, "--hl-origin": "left" });
}

/**
 * The line splitter can cut a phrase into pieces (one per line, now and then two on one line), so
 * the pieces sweep and retract as one stroke: in reading order, each for its share of the width.
 */
export function highlightTimeline(targets: readonly Element[]) {
  const tl = gsap.timeline();
  const pieces = withText(targets);
  if (pieces.length === 0) return tl;
  const widths = pieces.map((piece) => piece.getBoundingClientRect().width || 1);
  const stroke = (bar: number) => {
    const line = gsap.timeline({ paused: true, defaults: { ease: "none" } });
    pieces.forEach((piece, i) => line.to(piece, { "--hl-bar": bar, duration: widths[i] }));
    return line;
  };
  return tl
    .to(stroke(1), { progress: 1, duration: 0.45, ease: EASE.inOut })
    .set(pieces, { "--hl-origin": "right", "--hl-mark": 1 })
    .to(stroke(0), { progress: 1, duration: 0.5, ease: EASE.inOut });
}

/** SplitText leaves an empty clone in front of a phrase (hidden by `.hl:empty`): skip those. */
function withText(targets: readonly Element[]) {
  return targets.filter((target) => target.textContent?.trim());
}
