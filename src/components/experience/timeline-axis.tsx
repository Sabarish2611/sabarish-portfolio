import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";

export type AxisTick = { year: number; x: number; label: boolean };

/** Year labels and "Now": small mono figures just above the axis line. */
const LABEL = "absolute bottom-2.5 font-mono text-[0.6875rem] leading-none tracking-[0.08em] whitespace-nowrap uppercase tabular-nums";

/**
 * The time axis from tablets up, in the middle row of the timeline grid: a ruler of years, the path
 * in accent from the first start to today (TimelineMotion draws it: data-tl-track="x"), then a
 * dashed line on into what's next. Positions are percentages of the axis (`start`, `now`, each
 * tick's `x`), so it reflows without measuring. Decorative: every date is in the entries' text.
 */
export function TimelineAxis({ start, now, ticks }: { start: number; now: number; ticks: readonly AxisTick[] }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none relative hidden md:col-start-1 md:row-start-2 md:block"
      style={{ "--start": `${start.toFixed(2)}%`, "--now": `${now.toFixed(2)}%` } as CSSProperties}
    >
      <div className="absolute inset-x-0 top-1/2 h-px bg-line" />

      {ticks.map(({ year, x, label }, index) => (
        <span key={year} className="absolute bottom-1/2 h-1.5 w-px bg-line-strong" style={{ left: `${x.toFixed(2)}%` }}>
          {label ? (
            // The first year starts at the axis' left edge; the others sit centred on their tick.
            <span className={cn(LABEL, "left-0 text-fg-muted", index > 0 && "-translate-x-1/2")}>{year}</span>
          ) : null}
        </span>
      ))}

      <div data-tl-track="x" className="absolute top-1/2 right-[calc(100%-var(--now))] left-(--start) h-px">
        <svg
          data-tl-svg
          data-reveal
          className="absolute inset-0 size-full"
          viewBox="0 0 100 1"
          preserveAspectRatio="none"
          focusable="false"
        >
          <line data-tl-line x1="0" y1="0.5" x2="100" y2="0.5" strokeWidth="1" className="stroke-accent-ink" />
        </svg>
      </div>

      <div
        data-tl-next
        data-reveal
        className="absolute top-1/2 right-0 left-(--now) border-t border-dashed border-line-strong [mask-image:linear-gradient(to_right,black,transparent)]"
      />

      <span className="absolute top-1/2 left-(--now)">
        <span data-tl-now-ring className="absolute -top-1 -left-1 size-2 rounded-full border border-accent-ink opacity-0" />
        <span data-tl-now data-reveal className="absolute -top-1 -left-1 size-2 rounded-full bg-accent-ink" />
        <span data-tl-now-label data-reveal className={cn(LABEL, "left-0 -translate-x-1/2 text-accent-ink")}>
          Now
        </span>
      </span>
    </div>
  );
}
