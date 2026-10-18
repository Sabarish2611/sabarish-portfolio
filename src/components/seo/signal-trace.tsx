"use client";

import { useRef } from "react";
import { PingDot } from "@/components/toolkit/ping";
import { cn } from "@/lib/cn";
import { DURATION, EASE, gsap, useGSAP } from "@/lib/gsap";
import { onIntroReveal } from "@/lib/intro";
import { mulberry32 } from "./prng";

const WIDTH = 1200;
const HEIGHT = 56;
const MID = HEIGHT / 2;
/** Where the signal dies, as a fraction of the width. */
const CUTOFF = 0.42;

/** A noisy oscillation whose amplitude decays into silence at CUTOFF. Deterministic. */
const NOISE_PATH = (() => {
  const rand = mulberry32(404);
  const end = WIDTH * CUTOFF;
  const step = 9;
  let d = `M0 ${MID}`;
  for (let x = step, i = 0; x < end; x += step, i++) {
    const amplitude = (MID - 3) * (1 - x / end) ** 1.25 * (0.3 + rand() * 0.7);
    d += ` L${x} ${(MID + (i % 2 ? amplitude : -amplitude)).toFixed(1)}`;
  }
  return `${d} L${end} ${MID}`;
})();

/**
 * System-page divider: signal decaying into a flatline, with a pulse where it was lost.
 * Wipes in left→right once the intro has revealed; static under reduced motion or `animate={false}`.
 */
export function SignalTrace({ animate = true, className }: { animate?: boolean; className?: string }) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = root.current;
      if (!el || !animate) return;
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set(el, { autoAlpha: 1 });
      });
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const intro = gsap
          .timeline({ paused: true })
          .set(el, { autoAlpha: 1 })
          .fromTo(
            "[data-trace-line]",
            { clipPath: "inset(0% 100% 0% 0%)" },
            { clipPath: "inset(0% 0% 0% 0%)", duration: DURATION.slower, ease: EASE.inOut },
          )
          .from("[data-trace-dot]", { scale: 0, autoAlpha: 0, duration: DURATION.base, ease: EASE.out }, 0.7);
        return onIntroReveal(() => intro.play());
      });
    },
    { scope: root, dependencies: [animate] },
  );

  return (
    <div ref={root} aria-hidden data-reveal={animate ? "" : undefined} className={cn("relative h-14", className)}>
      <svg
        data-trace-line
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        fill="none"
        className="absolute inset-0 size-full overflow-visible"
      >
        <path d={NOISE_PATH} vectorEffect="non-scaling-stroke" strokeLinejoin="round" className="stroke-fg-muted" />
        <path d={`M${WIDTH * CUTOFF} ${MID} H${WIDTH}`} vectorEffect="non-scaling-stroke" className="stroke-line-strong" />
      </svg>
      {/* Pings once the wipe has reached it (the dot scales in at 0.7s). */}
      <PingDot
        data-trace-dot=""
        delay={animate ? 1400 : 0}
        className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{ left: `${CUTOFF * 100}%` }}
      />
    </div>
  );
}
