import type { ReactNode } from "react";
import { RevealText } from "@/components/ui/reveal-text";
import type { TimelineItem } from "./timeline-items";

/**
 * The marker on the track. Server-rendered filled (the no-JS / reduced-motion final state);
 * TimelineMotion empties it and fills it again when the drawn line arrives.
 * Centred on the eyebrow's first line (label 12px × 1.25 → 7.5px) and on the track (x 5.5px).
 */
function TimelineNode() {
  return (
    <span aria-hidden data-tl-node className="absolute top-0.5 left-0 size-[11px]">
      <span className="absolute inset-0 rounded-full border border-line-strong bg-bg" />
      <span data-tl-ring className="absolute -inset-px rounded-full border border-accent-ink opacity-0" />
      <span data-tl-fill data-reveal className="absolute -inset-px rounded-full bg-accent-ink" />
    </span>
  );
}

export function TimelineEntry({ item, children }: { item: TimelineItem; children?: ReactNode }) {
  return (
    <li data-tl-entry className="relative pl-9 sm:pl-12 lg:pl-16">
      <TimelineNode />

      <p data-tl-item data-reveal className="eyebrow flex flex-wrap items-center gap-x-3 gap-y-2 text-fg-muted">
        <span>
          <time dateTime={item.startISO}>{item.start}</time>
          {"–"}
          {item.endISO ? (
            <time dateTime={item.endISO}>{item.end}</time>
          ) : (
            <span className="text-accent-ink">{item.end}</span>
          )}
        </span>
        {item.kind === "education" ? (
          <>
            <span aria-hidden className="h-px w-6 bg-line-strong" />
            <span>Education</span>
          </>
        ) : null}
      </p>

      <RevealText as="h3" className="mt-5 max-w-[22ch] font-serif text-headline md:mt-6">
        {item.title}
      </RevealText>

      <p data-tl-item data-reveal className="mt-3 text-lead text-fg-muted md:mt-4">
        {item.org}
        {item.place ? `, ${item.place}` : null}
      </p>

      {item.summary ? (
        <p data-tl-item data-reveal className="mt-6 max-w-[60ch] text-fg-muted md:mt-8">
          {item.summary}
        </p>
      ) : null}

      {children}
    </li>
  );
}
