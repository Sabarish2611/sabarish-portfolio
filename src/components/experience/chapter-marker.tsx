import { cn } from "@/lib/cn";
import { startYear, type TimelineItem } from "./timeline-items";

type Layer = { value: string; from: number; to: number };

/** Collapses consecutive repeats into layers spanning entry indexes: ["2","2","1"] → 2 (0–1), 1 (2). */
function toLayers(values: readonly string[]): Layer[] {
  const layers: Layer[] = [];
  values.forEach((value, i) => {
    const last = layers.at(-1);
    if (last?.value === value) last.to = i;
    else layers.push({ value, from: i, to: i });
  });
  return layers;
}

/**
 * Layer position, driven by data-place ("below" = waiting, "above" = already passed): CSS rolls it
 * through the slot's mask (split-flap) or, with reduced motion, cross-fades it in 200ms.
 * TimelineMotion only flips the attribute (and a cascade delay), so nothing is measured or tweened.
 */
const LAYER = cn(
  "col-start-1 row-start-1",
  "motion-safe:transition-[translate] motion-safe:duration-800 motion-safe:ease-in-out",
  "motion-safe:data-[place=below]:translate-y-[120%] motion-safe:data-[place=above]:-translate-y-[120%]",
  "motion-reduce:transition-opacity motion-reduce:duration-200",
  "motion-reduce:data-[place=below]:opacity-0 motion-reduce:data-[place=above]:opacity-0",
);

/**
 * One masked slot of the marker: its possible values stacked in a single grid cell. Each layer
 * carries the entry range it stands for (data-from/to) and the slot's place in the roll cascade
 * (data-cell); TimelineMotion rolls whichever slots change. The first entry's state is the
 * server-rendered (no-JS) one.
 */
function Slot({ layers, cell, className }: { layers: Layer[]; cell: number; className?: string }) {
  return (
    <span className={cn("grid overflow-hidden", className)}>
      {layers.map((layer) => (
        <span
          key={layer.from}
          data-tl-layer=""
          data-from={layer.from}
          data-to={layer.to}
          data-cell={cell}
          data-place={layer.from > 0 ? "below" : "show"}
          className={LAYER}
        >
          {layer.value}
        </span>
      ))}
    </span>
  );
}

/**
 * Sticky "you are here" marker beside the timeline (desktop): the active entry's start year in
 * display serif. Only what changes moves: digits roll
 * like a split-flap board, top to bottom. Decorative (it repeats the entries), so aria-hidden.
 */
export function ChapterMarker({ items }: { items: readonly TimelineItem[] }) {
  const years = items.map(startYear);
  const width = Math.max(...years.map((year) => year.length));
  const digits = Array.from({ length: width }, (_, k) => toLayers(years.map((year) => year[k] ?? "")));

  return (
    <div aria-hidden className="sticky top-[calc(var(--header-h)+2rem)]">
      <div className="flex font-serif text-display leading-none">
        {digits.map((layers, k) => (
          // Padding gives the glyphs room inside the mask without shifting the line.
          <Slot key={k} layers={layers} cell={k} className="-my-[0.12em] justify-items-center py-[0.12em]" />
        ))}
      </div>

    </div>
  );
}
