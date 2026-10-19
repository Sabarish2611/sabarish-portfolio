import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";
import type { TimelineItem } from "./timeline-items";

/** Which side of the axis a stop hangs on, from tablets up. */
export type TimelineSide = "up" | "down";

/**
 * The marker on the track. Server-rendered filled (the no-JS / reduced-motion final state);
 * TimelineMotion empties it and fills it again when the drawn line arrives. Phones: centred on the
 * eyebrow's first line (label 12px × 1.25 → 7.5px) and on the vertical rail (x 5.5px). Wider: in the
 * axis row, centred on the axis line, above the stem that meets it there.
 */
function TimelineNode({ side }: { side: TimelineSide }) {
  return (
    <span
      aria-hidden
      data-tl-node
      className={cn(
        "absolute top-0.5 left-0 z-[1] size-[11px] md:relative md:top-0 md:self-center",
        side === "up" ? "md:row-start-2" : "md:row-start-1",
      )}
    >
      <span className="absolute inset-0 rounded-full border border-line-strong bg-bg" />
      <span data-tl-ring className="absolute -inset-px rounded-full border border-accent-ink opacity-0" />
      <span data-tl-fill data-reveal className="absolute -inset-px rounded-full bg-accent-ink" />
    </span>
  );
}

/**
 * One stop. Phones: a row beside the vertical rail. Wider: the stop spans the axis row and its own
 * side's row of the timeline grid (subgrid rows, so every stop shares the axis), starting at its date
 * (`x`, percent of the axis) and running no further than `room` (to the next stop on its side). A
 * stem rises from the node on the axis, or drops below it, and runs the height of the text.
 */
export function TimelineEntry({ item, side, x, room }: { item: TimelineItem; side: TimelineSide; x: number; room: number }) {
  const up = side === "up";
  return (
    <li
      data-tl-entry
      style={{ "--x": `${x.toFixed(2)}%`, "--room": `${room.toFixed(2)}%` } as CSSProperties}
      className={cn(
        "relative pl-9 sm:pl-12 md:col-start-1 md:row-span-2 md:grid md:w-[min(26rem,var(--room)_-_1.5rem)] md:grid-rows-subgrid md:ml-[calc(var(--x)_-_5.5px)] md:pl-0",
        up ? "md:row-start-1" : "md:row-start-2",
      )}
    >
      <TimelineNode side={side} />

      <div
        className={cn(
          "group relative md:pl-5",
          up ? "md:row-start-1 md:self-end md:pb-(--gap)" : "md:row-start-2 md:self-start md:pt-(--gap)",
        )}
      >
        <span
          aria-hidden
          data-tl-pole
          className={cn(
            "absolute left-[5px] hidden w-px bg-line-strong transition-colors duration-300 group-hover:bg-accent-ink md:block",
            up ? "top-0.5 -bottom-[calc(var(--axis)/2)] origin-bottom" : "-top-[calc(var(--axis)/2)] bottom-0.5 origin-top",
          )}
        />

        <p data-tl-item data-reveal className="eyebrow flex flex-wrap items-center gap-x-3 gap-y-1 text-fg-muted">
          <span>
            <time dateTime={item.startISO}>{item.start}</time>
            {" – "}
            {item.endISO ? (
              <time dateTime={item.endISO}>{item.end}</time>
            ) : (
              <span className="text-accent-ink">{item.end}</span>
            )}
          </span>
          {item.kind === "education" ? (
            <>
              <span aria-hidden className="h-px w-5 bg-line-strong" />
              <span>Education</span>
            </>
          ) : null}
        </p>

        <h3
          data-tl-item
          data-reveal
          className="mt-3 max-w-[20ch] font-serif text-[length:clamp(1.75rem,min(2.7vw,4.6svh),2.875rem)] leading-[1.02] tracking-[-0.015em] md:mt-[clamp(0.5rem,1.4svh,1rem)]"
        >
          {item.title}
        </h3>

        <p data-tl-item data-reveal className="mt-2 text-[0.9375rem] text-fg">
          {item.org}
          {item.place ? <span className="text-fg-muted">{`, ${item.place}`}</span> : null}
        </p>

        {item.cgpa ? (
          <dl data-tl-item data-reveal className="eyebrow mt-3 flex gap-2 md:mt-[clamp(0.5rem,1.4svh,0.875rem)]">
            <dt className="text-fg-muted">CGPA</dt>
            <dd className="text-fg">{item.cgpa}</dd>
          </dl>
        ) : null}
      </div>
    </li>
  );
}
