"use client";

import { useRef, useState } from "react";
import { site } from "@/content/site";
import { useLocalTime } from "@/hooks/use-local-time";
import { cn } from "@/lib/cn";
import { DAY, hhmm, mod, spanShort, spanWords, useNowMinute, useVisitorZone, zoneCity, zoneOffset } from "./time";

const STEP = 15;
/** The labelled hours on the ruler: the visitor's day, every six hours. */
const MAJOR = [0, 6, 12, 18];
const HOURS = Array.from({ length: 24 }, (_, h) => h);
const CITY = site.location.city;
const LABEL = "font-mono text-[0.6875rem] leading-none tabular-nums text-fg-muted";

function Clock({ label, value, note, end, hidden }: { label: string; value: string; note?: string; end?: boolean; hidden?: boolean }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", end && "items-end text-right", hidden && "invisible")}>
      <span className="eyebrow truncate text-fg-muted">{label}</span>
      <span className="flex items-baseline gap-2">
        <span
          data-qa-mask
          suppressHydrationWarning
          className="font-sans text-[length:clamp(1.75rem,4.4svh,2.75rem)] leading-none font-light tracking-[-0.04em] tabular-nums"
        >
          {value}
        </span>
        {note ? <span className="eyebrow text-accent-ink">{note}</span> : null}
      </span>
    </div>
  );
}

/**
 * For a visitor on another clock: theirs beside the one in Trichy, joined by the offset, over one
 * 24-hour ruler of their day with Trichy's time under each six-hour mark. The ruler is a range input,
 * so it can be dragged or arrowed to read "your 10:00 is 19:30 in Trichy". It follows the current
 * minute until a time is picked. Computed from Intl only; it says nothing about working hours.
 */
function TwoClocks() {
  const now = useNowMinute();
  const zone = useVisitorZone();
  const [picked, setPicked] = useState<number | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const ready = now !== null && zone !== null;
  const youOffset = ready ? zoneOffset(zone, now) : 0;
  const homeOffset = ready ? zoneOffset(site.location.timeZone, now) : 0;
  /** Minutes Trichy is ahead of the visitor (negative: behind). */
  const diff = homeOffset - youOffset;
  const nowYou = ready ? mod(now + youOffset, DAY) : null;
  const you = picked ?? nowYou ?? 12 * 60;
  const there = you + diff;
  const dayShift = Math.floor(there / DAY);
  const dayNote = dayShift > 0 ? "+1 day" : dayShift < 0 ? "−1 day" : undefined;
  const dayWords = dayShift > 0 ? " the next day" : dayShift < 0 ? " the day before" : "";
  const offsetSentence =
    diff === 0 ? `${CITY} is on your time.` : `${CITY} is ${spanWords(diff)} ${diff > 0 ? "ahead of" : "behind"} you.`;
  const pickSentence = `Your ${hhmm(you)} is ${hhmm(there)} in ${CITY}${dayWords}.`;
  const city = zone ? zoneCity(zone) : "";

  return (
    <div className="flex flex-col gap-[clamp(0.75rem,2svh,1.25rem)]">
      {/* The two clocks, and the distance between them on the line that joins them. */}
      <div className="grid grid-cols-[minmax(0,auto)_minmax(2.5rem,1fr)_minmax(0,auto)] items-end gap-x-[clamp(0.75rem,2vw,1.5rem)]">
        <Clock label={city ? `You · ${city}` : "You"} value={ready ? hhmm(you) : "--:--"} hidden={!ready} />
        <div aria-hidden className="relative mb-[clamp(0.75rem,2.2svh,1.25rem)] h-px bg-line-strong">
          {ready ? (
            <span className="eyebrow absolute top-1/2 left-1/2 -translate-1/2 bg-bg px-2 whitespace-nowrap text-accent-ink tabular-nums">
              {spanShort(diff)}
            </span>
          ) : null}
        </div>
        <Clock
          end
          label={`${CITY} · ${site.location.timeZoneLabel}`}
          value={ready ? hhmm(there) : site.location.utcOffset}
          note={ready ? dayNote : undefined}
        />
      </div>

      {/* One ruler: the visitor's hours above it, Trichy's below. The range input covers all three
          rows, so the whole band is the handle (about 64px tall: thumb-sized on a phone). */}
      <div className="grid grid-cols-[auto_minmax(0,1fr)] grid-rows-[auto_1.75rem_auto] gap-x-4 gap-y-1.5">
        <span className="eyebrow col-start-1 row-start-1 self-end text-fg-muted">You</span>
        <span className="eyebrow col-start-1 row-start-3 self-start text-fg-muted">{CITY}</span>
        <div aria-hidden className="relative col-start-2 row-start-1 h-3">
          {MAJOR.map((h) => (
            <span key={h} className={cn(LABEL, "absolute top-0", h ? "-translate-x-1/2" : "")} style={{ left: `${(h / 24) * 100}%` }}>
              {String(h).padStart(2, "0")}
            </span>
          ))}
        </div>
        <div aria-hidden className={cn("relative col-start-2 row-start-2", !ready && "opacity-40")}>
          <span className="absolute inset-x-0 top-1/2 h-px bg-line-strong" />
          {HOURS.map((h) => (
            <span
              key={h}
              className={cn("absolute top-1/2 w-px -translate-1/2", h % 6 ? "h-1.5 bg-line-strong" : "h-3 bg-fg-muted")}
              style={{ left: `${(h / 24) * 100}%` }}
            />
          ))}
          {picked !== null && nowYou !== null ? (
            <span
              className="absolute top-1/2 size-1.5 -translate-1/2 rounded-full bg-accent-ink"
              style={{ left: `${(nowYou / DAY) * 100}%` }}
            />
          ) : null}
        </div>
        <div aria-hidden className="relative col-start-2 row-start-3 h-3">
          {ready
            ? MAJOR.map((h) => (
                <span key={h} className={cn(LABEL, "absolute top-0", h ? "-translate-x-1/2" : "")} style={{ left: `${(h / 24) * 100}%` }}>
                  {hhmm(h * 60 + diff)}
                </span>
              ))
            : null}
        </div>
        <div className="relative col-start-2 row-span-3 row-start-1">
          {/* The input runs 00:00 to 23:45, so it covers that much of the ruler's 24 hours: the time under
              the pointer is the time picked. While it follows now, its value is the step at or before it. */}
          <input
            ref={input}
            type="range"
            min={0}
            max={DAY - STEP}
            step={STEP}
            value={Math.floor(you / STEP) * STEP}
            disabled={!ready}
            onChange={(event) => setPicked(Number(event.currentTarget.value))}
            aria-label={`Compare a time of your day with the time in ${CITY}`}
            aria-valuetext={ready ? pickSentence : undefined}
            style={{ width: `${((DAY - STEP) / DAY) * 100}%` }}
            className="peer absolute inset-y-0 left-0 h-full cursor-ew-resize appearance-none bg-transparent opacity-0 disabled:cursor-default [&::-moz-range-thumb]:size-px [&::-moz-range-thumb]:border-0 [&::-webkit-slider-thumb]:size-px [&::-webkit-slider-thumb]:appearance-none"
          />
          {ready ? (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 w-px -translate-x-1/2 bg-accent-ink"
              style={{ left: `${(you / DAY) * 100}%` }}
            >
              <span className="chamfer-fill absolute top-1/2 left-1/2 h-5 w-3 -translate-1/2 [--cut:4px] [--fill:var(--accent-ink)]" />
            </span>
          ) : null}
          <span
            aria-hidden
            className="pointer-events-none absolute -inset-1.5 hidden rounded-[4px] outline-2 outline-accent-ink peer-focus-visible:block"
          />
        </div>
      </div>

      {/* What the ruler says, in words: the offset while it follows now, the picked time once moved. */}
      <div className="flex min-h-9 flex-wrap items-center gap-x-4 gap-y-2">
        <p className="text-[0.9375rem] text-fg-muted">
          {!ready ? (
            `${site.location.timeZoneLabel}, ${site.location.utcOffset}`
          ) : picked === null ? (
            <>
              <span aria-hidden className="mr-2 inline-block size-1.5 -translate-y-px rounded-full bg-accent-ink align-middle" />
              <span className="text-fg">{offsetSentence}</span>
              {" Drag the ruler to compare."}
            </>
          ) : (
            <span className="text-fg">{pickSentence}</span>
          )}
        </p>
        {ready && picked !== null ? (
          <button
            type="button"
            onClick={() => {
              // The button leaves with the picked time: keep focus on the ruler rather than drop it.
              input.current?.focus();
              setPicked(null);
            }}
            className="eyebrow chamfer-outline inline-flex h-11 items-center px-4 text-fg hover:[--outline:var(--fg)] md:h-9"
          >
            Back to now
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** For a visitor on the same clock as Trichy: one line, with the time there. */
function SameClock() {
  const time = useLocalTime(site.location.timeZone);
  return (
    <p className="flex items-center gap-2.5 text-[length:clamp(1rem,1.3vw,1.1875rem)]">
      <span aria-hidden className="size-1.5 rounded-full bg-accent-ink" />
      <span>
        {`${CITY} is on your time · `}
        <time data-qa-mask suppressHydrationWarning className="tabular-nums">
          {time ?? "--:--"}
        </time>
        {` ${site.location.timeZoneLabel}`}
      </span>
    </p>
  );
}

/**
 * Where Sabarish is, and the time there. The head script sets html[data-clock] before first paint
 * (lib/preferences.ts), so the right one of three shows from the first frame: one line for a visitor
 * on the same clock, the two clocks for everyone else, and without JavaScript the plain offset.
 */
export function ContactClocks() {
  return (
    <div className="border-t border-line pt-[clamp(0.875rem,2.2svh,1.5rem)]">
      <p className="eyebrow mb-[clamp(0.875rem,2.4svh,1.5rem)] flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-fg-muted">
        <span>{`Based in ${CITY}, ${site.location.region}, ${site.location.country}`}</span>
        <span className="text-fg">{`Open to ${site.openTo.toLowerCase()}`}</span>
      </p>
      <p className="text-[length:clamp(1rem,1.3vw,1.1875rem)] [[data-clock]_&]:hidden">
        {`${site.location.timeZoneLabel}, ${site.location.utcOffset}`}
      </p>
      <div className="hidden [[data-clock=same]_&]:block">
        <SameClock />
      </div>
      <div className="hidden [[data-clock=other]_&]:block">
        <TwoClocks />
      </div>
    </div>
  );
}
