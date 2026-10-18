import type Lenis from "lenis";
import { EASE } from "@/lib/gsap";

/**
 * The one way to glide to a place on the page. Duration scales with distance (short hops stay
 * snappy, long jumps cap out instead of smearing past at 25k px/s) and uses the site's in-out ease.
 * Lenis makes it instant under prefers-reduced-motion.
 */
export function glideTo(lenis: Lenis | undefined, target: HTMLElement | number, onComplete?: () => void) {
  const y = typeof target === "number" ? target : target.getBoundingClientRect().top + window.scrollY;
  if (!lenis) {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: y, behavior: reduce ? "auto" : "smooth" });
    onComplete?.();
    return;
  }
  const distance = Math.abs(y - window.scrollY);
  const duration = Math.min(1.6, Math.max(0.6, 0.4 + distance / 2500));
  lenis.scrollTo(y, { duration, easing: EASE.inOut, onComplete: () => onComplete?.() });
}
