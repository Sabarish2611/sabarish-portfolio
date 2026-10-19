import gsap from "gsap";
import { CustomEase } from "gsap/CustomEase";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { ScrambleTextPlugin } from "gsap/ScrambleTextPlugin";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText, CustomEase, DrawSVGPlugin, ScrambleTextPlugin);

/**
 * Motion language — mirrors the --ease-* tokens in globals.css so GSAP, Motion and CSS
 * transitions all move the same way. Use these names instead of ad-hoc eases.
 */
export const EASE = {
  /** Reveals, entrances: fast start, long soft landing. cubic-bezier(0.16, 1, 0.3, 1) */
  out: CustomEase.create("site-out", "M0,0 C0.16,1 0.3,1 1,1"),
  /** Curtains, page transitions, anything that both leaves and arrives. cubic-bezier(0.76, 0, 0.24, 1) */
  inOut: CustomEase.create("site-in-out", "M0,0 C0.76,0 0.24,1 1,1"),
  /** Exits. cubic-bezier(0.7, 0, 0.84, 0) */
  in: CustomEase.create("site-in", "M0,0 C0.7,0 0.84,0 1,1"),
} as const;

/** Durations in seconds — mirrors --duration-* tokens. */
export const DURATION = {
  fast: 0.35,
  base: 0.7,
  slow: 1.1,
  slower: 1.6,
} as const;

/**
 * GSAP 3.15 workaround. A new ScrollTrigger force-refreshes the timeline-attached triggers still
 * waiting for their first tick (the project cards' entrances), and the `once` ones that fire in
 * that loop splice the array it is walking: a TypeError that takes the page down whenever it is set
 * up scrolled past them (a /#contact link, a reload mid-page). Initialized in order first, they
 * leave that loop nothing to do. Call before creating a `once` trigger.
 */
export function settlePendingTriggers() {
  for (const trigger of ScrollTrigger.getAll()) if (!trigger.end) trigger.refresh();
}

export { gsap, ScrollTrigger, SplitText, useGSAP };
