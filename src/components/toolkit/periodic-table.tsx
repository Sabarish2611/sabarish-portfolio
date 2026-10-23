"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { TOOL_ICONS } from "@/content/tool-icons";
import { cn } from "@/lib/cn";
import { EASE, gsap, ScrollTrigger, settlePendingTriggers, useGSAP } from "@/lib/gsap";
import type { ToolkitElement } from "./toolkit-data";

/** Each group's tile tint: the foreground mixed in at rising strengths, like a printed table's greys.
 *  The top step stays low enough for text-fg to keep 4.5:1 on it in the dark theme. */
const TINTS = [4, 11, 19, 28, 38];
const strength = (group: number) => TINTS[group % TINTS.length];
const tint = (group: number) => `color-mix(in oklab, var(--fg) ${strength(group)}%, transparent)`;
/** Muted text nears or falls under 4.5:1 from the 11% tint up (4.5:1 there in the light theme, 2.6:1 at
 *  the top step): there a tile's small text uses the full foreground. */
const smallText = (group: number) => (strength(group) >= 10 ? "text-fg" : "text-fg-muted");

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
};

/**
 * The Toolkit as a periodic table: each skill an element, numbered in résumé order and set where
 * that element sits in the real table, tinted by its résumé group. The notch above the middle block
 * holds the enlarged element and the key, as in interactive tables: pointing at, tapping or arrowing
 * to an element shows its full name, group and the case studies whose stack used it. The key's groups
 * are toggle buttons: pointing at one previews its elements, a click, tap, Enter or Space pins the
 * highlight, Escape clears it. Below lg the elements wrap in a plain grid under the key.
 * Entrance: the elements fill in by number. Reduced motion: the finished table.
 */
export function PeriodicTable({ elements, groups }: { elements: readonly ToolkitElement[]; groups: readonly string[] }) {
  const root = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  // The key's highlight: a mouse hover previews a group, a pinned group stays lit until toggled off.
  const [hovered, setHovered] = useState<number | null>(null);
  const [pinned, setPinned] = useState<number | null>(null);
  const lit = hovered ?? pinned;
  const shown = elements[active];
  const counts = groups.map((_, g) => elements.filter((e) => e.group === g).length);

  useGSAP(
    () => {
      const el = root.current;
      if (!el) return;
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: reduce)", () => void gsap.set(el, { autoAlpha: 1 }));
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const tiles = gsap.utils.toArray<HTMLElement>("[data-tile]", el);
        const key = gsap.utils.toArray<HTMLElement>("[data-key]", el);
        gsap.set(el, { autoAlpha: 1 });
        // Opacity, not autoAlpha: the tiles stay in the tab order before the entrance has played.
        const intro = gsap
          .timeline({ paused: true, defaults: { ease: EASE.out } })
          .fromTo(tiles, { opacity: 0, y: 10, scale: 0.92 }, { opacity: 1, y: 0, scale: 1, duration: 0.5, stagger: 0.018 }, 0)
          .fromTo(key, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.7, stagger: 0.1 }, 0.35);
        settlePendingTriggers();
        ScrollTrigger.create({ trigger: el, start: "top 80%", once: true, onEnter: () => void intro.play() });
        // Tabbing in before the table has scrolled into view finishes the entrance at once.
        const finish = () => void intro.progress(1);
        el.addEventListener("focusin", finish);
        return () => el.removeEventListener("focusin", finish);
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  // Arrow keys move to the nearest element in that direction, as across the printed table.
  const onKeyDown = (event: KeyboardEvent<HTMLOListElement>) => {
    const step = ARROWS[event.key];
    if (!step) return;
    event.preventDefault();
    const from = elements[active];
    let best = -1;
    let bestScore = Infinity;
    elements.forEach((e, i) => {
      const dr = e.row - from.row;
      const dc = e.col - from.col;
      const along = step[0] ? dr * step[0] : dc * step[1];
      if (along <= 0) return;
      const across = step[0] ? Math.abs(dc) : Math.abs(dr);
      const score = along + across * 3;
      if (score < bestScore) [best, bestScore] = [i, score];
    });
    if (best < 0) return;
    setActive(best);
    root.current?.querySelector<HTMLElement>(`[data-tile="${best}"]`)?.focus();
  };

  // Escape anywhere in the table clears the key's highlight.
  const onRootKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape" || lit === null) return;
    setPinned(null);
    setHovered(null);
  };
  // Hover previews are for mice only: a tap fires pointerenter too, and its click is what pins.
  const hoverGroup = (g: number | null) => (event: PointerEvent) => {
    if (event.pointerType === "mouse") setHovered(g);
  };

  const icon = shown.icon ? TOOL_ICONS[shown.icon] : null;

  return (
    <div
      ref={root}
      data-reveal
      onKeyDown={onRootKeyDown}
      className="mx-auto grid max-w-[88rem] grid-cols-6 gap-1 sm:grid-cols-9 md:grid-cols-10 lg:grid-cols-18 lg:gap-[clamp(3px,0.3vw,5px)]"
    >
      {/* The notch: the enlarged element and the key. */}
      <div className="col-span-full mb-4 grid grid-cols-[auto_1fr] gap-x-[clamp(1rem,2vw,2rem)] gap-y-4 lg:col-[3/13] lg:row-[1/4] lg:mb-0 lg:px-[clamp(0.5rem,1vw,1rem)]">
        <div
          data-key
          aria-live="polite"
          className="chamfer relative flex aspect-square w-[clamp(7rem,13svh,9.5rem)] flex-col justify-between p-3 [--cut:0.75rem]"
          style={{ background: tint(shown.group) }}
        >
          <span className={cn("flex items-start justify-between font-mono text-xs tabular-nums", smallText(shown.group))}>
            {shown.number}
            {icon ? (
              <svg aria-hidden viewBox="0 0 24 24" className="size-4 fill-current">
                <path d={icon.path} />
              </svg>
            ) : null}
          </span>
          <span
            aria-hidden
            className={cn(
              "text-[clamp(2.5rem,6svh,3.5rem)] leading-none text-fg",
              shown.method ? "font-serif italic" : "font-medium tracking-[-0.03em]",
            )}
          >
            {shown.symbol}
          </span>
          <span className="truncate text-xs text-fg">{shown.name}</span>
        </div>
        <div data-key className="flex min-w-0 flex-col justify-between gap-3">
          <dl className="grid gap-1 text-sm">
            <dt className="sr-only">Group</dt>
            <dd className="eyebrow text-accent-ink">{groups[shown.group]}</dd>
            <dt className="sr-only">Used in</dt>
            <dd className="text-fg-muted">
              {shown.usedIn.length ? `Used in ${shown.usedIn.join(" · ")}` : shown.method ? "A method" : "A tool"}
            </dd>
          </dl>
          <ul aria-label="Groups" className="grid w-fit gap-x-6 sm:grid-cols-2 xl:gap-x-8">
            {groups.map((label, g) => (
              <li key={label}>
                <button
                  type="button"
                  aria-pressed={pinned === g}
                  onClick={() => setPinned((p) => (p === g ? null : g))}
                  onPointerEnter={hoverGroup(g)}
                  onPointerLeave={hoverGroup(null)}
                  className={cn(
                    "flex min-h-11 cursor-pointer items-center gap-2 text-left text-xs whitespace-nowrap transition-colors duration-300 hover:text-fg md:min-h-6",
                    lit === g ? "text-fg" : "text-fg-muted",
                  )}
                >
                  {/* A mini tile: the group's tint inside a hairline, cut like the elements. The pinned
                      group's outline turns accent, like the selected element's. */}
                  <span aria-hidden className="chamfer relative size-4 shrink-0 [--cut:4px]" style={{ background: tint(g) }}>
                    <span
                      className={cn(
                        "chamfer-ring absolute inset-0 [--cut:4px]",
                        pinned === g ? "bg-accent-ink [--ring:1.5px]" : "bg-line-strong",
                      )}
                    />
                  </span>
                  <span>{label}</span>
                  <span className="font-mono tabular-nums">{counts[g]}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <ol aria-label="Skills" onKeyDown={onKeyDown} className="contents">
        {elements.map((e, i) => {
          const on = i === active;
          const dim = lit !== null && lit !== e.group;
          return (
            <li
              key={e.name}
              data-tile={i}
              tabIndex={on ? 0 : -1}
              onPointerEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onClick={() => setActive(i)}
              className="group/tile relative aspect-square min-w-0 cursor-default outline-none lg:[grid-column:var(--c)] lg:[grid-row:var(--r)]"
              style={{ ["--r" as string]: e.row, ["--c" as string]: e.col }}
            >
              {/* The entrance animates the item; the group dimming fades this face, so the two never
                  fight over one element's opacity. */}
              <span
                aria-hidden
                className={cn(
                  "chamfer absolute inset-0 flex flex-col justify-between p-[clamp(3px,0.35vw,6px)] transition-opacity duration-300 [--cut:0.4rem]",
                  dim && "opacity-25",
                )}
                style={{ background: tint(e.group) }}
              >
                {/* The selected element's outline; also the focus indicator, which the clip would cut off. */}
                {on ? <span className="chamfer-ring absolute inset-0 bg-accent-ink [--cut:0.4rem] [--ring:1.5px]" /> : null}
                <span className={cn("font-mono text-[0.625rem] leading-none tabular-nums", smallText(e.group))}>{e.number}</span>
                <span
                  className={cn(
                    "text-center text-[clamp(1rem,1.6vw,1.6rem)] leading-none text-fg",
                    e.method ? "font-serif italic" : "font-medium tracking-[-0.02em]",
                  )}
                >
                  {e.symbol}
                </span>
                <span
                  className={cn(
                    "truncate text-center text-[0.5625rem] leading-none sm:text-[0.625rem] lg:max-xl:hidden",
                    smallText(e.group),
                  )}
                >
                  {e.label}
                </span>
              </span>
              {/* Keyboard focus gets its own cue: the selected outline alone looks the same before and after
                  Tab arrives on the selected tile. Outside the face, which the clip would cut. */}
              <span
                aria-hidden
                className="detect-brackets pointer-events-none absolute -inset-1 hidden text-accent-ink [--arm:0.5rem] group-focus-visible/tile:block"
              />
              <span className="sr-only">{`${e.name}, ${groups[e.group]}${e.usedIn.length ? `, used in ${e.usedIn.join(" and ")}` : ""}`}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
