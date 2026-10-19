import { cacheLife } from "next/cache";
import { TimelineAxis } from "@/components/experience/timeline-axis";
import { TimelineEntry, type TimelineSide } from "@/components/experience/timeline-entry";
import { timeAxis, timelineItems, timelineOrgs, timelineSpan, toYear } from "@/components/experience/timeline-items";
import { TimelineMotion } from "@/components/experience/timeline-motion";
import { TimelineTrack } from "@/components/experience/timeline-track";
import { SectionHeader } from "@/components/ui/section-header";

/** Today as a year with a fraction (Oct 2026 → 2026.75): where the path ends. Cached a day, like the footer's year. */
async function today() {
  "use cache";
  cacheLife("days");
  const now = new Date();
  return now.getFullYear() + now.getMonth() / 12;
}

/**
 * Year labels closer than this (percent of the axis) to a stem rising above the axis, or to "Now",
 * are left out; their ticks stay. 3.5% is ~25px on the narrowest axis (a 768px screen).
 */
const CLEAR_OF_STEM = 3.5;
const CLEAR_OF_NOW = 5;

/**
 * (02) Experience — roles and education, oldest first, on a path drawn as it comes into view. The
 * case studies come right after, in (03) Work, so each stop stays lean: dates, role, where. From
 * tablets up the section fits one screen: a time axis, true to the dates, with the stops alternating
 * above and below it. Phones keep a vertical rail.
 */
export async function Experience() {
  const now = await today();
  // The aside sums up the work alone: its years and employers (the degree is on the path, not in the sum).
  const roles = timelineItems.filter((item) => item.kind === "role");
  const { from, at } = timeAxis(timelineItems, now);
  const stops = timelineItems.map((item, index) => {
    const side: TimelineSide = index % 2 ? "down" : "up";
    return { item, side, x: at(toYear(item.startISO)) };
  });
  // How far each stop's text may run: to the next stop on the same side, or to the end of the axis.
  const room = stops.map(
    (stop, index) => (stops.slice(index + 1).find((next) => next.side === stop.side)?.x ?? 100) - stop.x,
  );
  const stems = stops.filter((stop) => stop.side === "up").map((stop) => stop.x);
  const nowX = at(now);
  const ticks = Array.from({ length: Math.floor(now) - from + 1 }, (_, index) => {
    const x = at(from + index);
    const label = stems.every((stem) => Math.abs(stem - x) >= CLEAR_OF_STEM) && nowX - x >= CLEAR_OF_NOW;
    return { year: from + index, x, label };
  });

  return (
    <section
      id="experience"
      aria-labelledby="experience-title"
      className="section-pad md:flex md:min-h-[calc(100svh-var(--header-h))] md:flex-col md:justify-center md:py-[clamp(0.75rem,2svh,2rem)]"
    >
      <TimelineMotion className="container-page">
        <SectionHeader
          compact
          index="02"
          label="Experience"
          headingId="experience-title"
          heading={
            <>
              {"The path so "}
              <span data-hl className="hl italic">
                far.
              </span>
            </>
          }
          aside={
            <p data-tl-item data-reveal className="eyebrow flex flex-col gap-1.5 text-fg-muted lg:items-end lg:pb-3">
              <span className="text-fg">{timelineSpan(roles)}</span>
              <span>{timelineOrgs(roles).join(" · ")}</span>
            </p>
          }
        />

        {/* Wider: three rows (stops above, the axis, stops below); the list and each stop are subgrids,
            so the axis row lines up with every node. --gap: between the text and the axis row. */}
        <div className="relative [--axis:2.75rem] [--gap:clamp(1.25rem,6svh,4.5rem)] md:grid md:grid-cols-1 md:grid-rows-[auto_var(--axis)_auto]">
          <TimelineTrack />
          <TimelineAxis start={stops[0]?.x ?? 0} now={nowX} ticks={ticks} />
          <ol
            role="list"
            className="flex flex-col gap-12 md:col-start-1 md:row-span-3 md:row-start-1 md:grid md:grid-cols-1 md:grid-rows-subgrid md:gap-0"
          >
            {stops.map(({ item, side, x }, index) => (
              <TimelineEntry key={item.id} item={item} side={side} x={x} room={room[index]} />
            ))}
          </ol>
        </div>
      </TimelineMotion>
    </section>
  );
}
