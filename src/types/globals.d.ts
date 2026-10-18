import type Lenis from "lenis";
import type { ScrollTrigger } from "gsap/ScrollTrigger";

declare global {
  interface Window {
    /** Exposed for scripts/qa.mjs so it can jump between sections deterministically. */
    __lenis?: Lenis;
    __ScrollTrigger?: typeof ScrollTrigger;
  }
}

export {};
