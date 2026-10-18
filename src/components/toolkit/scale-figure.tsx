"use client";

import { useRef } from "react";
import { Stat } from "@/components/ui/stat";
import { cn } from "@/lib/cn";
import { DURATION, EASE, gsap, SplitText, useGSAP } from "@/lib/gsap";

const TICKS = 61;
/** Seconds one tick takes to settle, and the gap between tick starts (in random order). */
const SETTLE = 1.6;
const STAGGER = 0.012;

/** Tick height as a share of the ruler: every 10th is major, every 5th mid. */
function tickHeight(i: number) {
  if (i % 10 === 0) return 1;
  if (i % 5 === 0) return 0.6;
  return 0.34;
}

/**
 * The Scale tile's hero figure over a decorative scale bar. On entrance the number slides up out of
 * a mask, then the ticks settle from random heights into an even ruler (the site's noise-to-order
 * motif). The ruler is illustration only; the last tick is the accent mark.
 */
export function ScaleFigure({ value, label, className }: { value: string; label: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const root = ref.current;
      const figure = root?.querySelector("dd");
      if (!root || !figure) return;
      const ticks = gsap.utils.toArray<HTMLElement>("[data-tick]", root);
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        // Words, not lines: the figure never wraps, so no re-split on resize is needed. aria "none"
        // keeps the real text readable (the default labels the dd and hides the pieces).
        const split = SplitText.create(figure, { type: "words", mask: "words", aria: "none" });

        // One clock drives every tick: each starts at a random height (a scale of its own height)
        // and settles after its own random delay. Write-only, no per-tick tweens or style reads.
        const from = ticks.map((_, i) => gsap.utils.random(0.06, 1) / tickHeight(i));
        const delay = gsap.utils.shuffle(ticks.map((_, i) => i * STAGGER));
        const shown: string[] = [];
        const render = (t: number) => {
          ticks.forEach((tick, i) => {
            const p = EASE.out(gsap.utils.clamp(0, 1, (t - delay[i]) / SETTLE));
            const transform = `scaleY(${(from[i] + (1 - from[i]) * p).toFixed(4)})`;
            if (transform === shown[i]) return;
            shown[i] = transform;
            tick.style.transform = transform;
          });
        };
        const settled = () => ticks.forEach((tick) => tick.style.removeProperty("transform"));
        render(0);

        const clock = { t: 0 };
        const total = SETTLE + STAGGER * (TICKS - 1);
        gsap
          .timeline({ scrollTrigger: { trigger: root, start: "top 88%", once: true } })
          .from(split.words, { yPercent: 110, duration: DURATION.slow, ease: EASE.out }, 0.15)
          .to(clock, { t: total, duration: total, ease: "none", onUpdate: () => render(clock.t), onComplete: settled }, 0.3);

        return settled;
      });
    },
    { scope: ref },
  );

  return (
    <div ref={ref} className={cn("flex flex-col gap-8", className)}>
      <dl>
        <Stat size="figure" value={value} label={label} />
      </dl>
      <div aria-hidden className="flex h-10 items-end justify-between">
        {Array.from({ length: TICKS }, (_, i) => {
          const height = tickHeight(i);
          return (
            <span
              key={i}
              data-tick=""
              style={{ height: `${height * 100}%` }}
              className={cn(
                "w-px origin-bottom",
                i === TICKS - 1 ? "bg-accent-ink" : height === 1 ? "bg-fg/45" : height > 0.5 ? "bg-fg/30" : "bg-fg/20",
              )}
            />
          );
        })}
      </div>
    </div>
  );
}
