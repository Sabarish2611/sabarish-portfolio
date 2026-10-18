"use client";

import { useRef, type ReactNode } from "react";
import { DURATION, EASE, gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";

/**
 * Viewport line the drawn line's tip rides on. The scrub maps the track's top→bottom onto this
 * line, so a node fills exactly when its centre crosses it — no measuring needed.
 */
const TIP = "70%";

/** Where an entry becomes the "current" one for the sticky chapter marker. */
const CHAPTER_LINE = "top 50%";

/**
 * Client-only behaviour for the server-rendered Experience markup, wired through data-tl-*
 * attributes: scroll-drawn line, nodes that fill when it arrives, one-time entrances, and the
 * sticky chapter marker. Reduced motion: final state (line drawn, nodes filled), 200ms fades.
 */
export function TimelineMotion({ children, className }: { children: ReactNode; className?: string }) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = root.current;
      if (!el) return;
      const all = (selector: string) => gsap.utils.toArray<HTMLElement>(selector, el);
      const track = el.querySelector("[data-tl-track]");
      const svg = el.querySelector("[data-tl-svg]");
      const line = el.querySelector("[data-tl-line]");
      const entries = all("[data-tl-entry]");
      const items = all("[data-tl-item]");
      const fills = all("[data-tl-fill]");
      const layers = all("[data-tl-layer]");

      const mm = gsap.matchMedia();
      mm.add(
        { reduce: "(prefers-reduced-motion: reduce)", motion: "(prefers-reduced-motion: no-preference)" },
        (context, contextSafe) => {
          // Tweens made later (ScrollTrigger callbacks) still belong to this context. The core
          // typing is (Function) => Function, so restore the wrapped signature.
          const safe = <A extends unknown[]>(fn: (...args: A) => void) =>
            (contextSafe ? contextSafe(fn) : fn) as (...args: A) => void;
          const reduce = Boolean(context.conditions?.reduce);

          // --- Chapter marker: CSS rolls each layer to its data-place (see ChapterMarker). The
          // markup is entry 0's state, so setup touches nothing.
          let active = 0;
          const placeOf = (layer: HTMLElement, index: number) =>
            index < Number(layer.dataset.from) ? "below" : index > Number(layer.dataset.to) ? "above" : "show";
          const moveLayers = (index: number, moving: HTMLElement[], cascade: boolean) => {
            const firstCell = Math.min(...moving.map((layer) => Number(layer.dataset.cell)));
            moving.forEach((layer) => {
              layer.style.transitionDelay = cascade ? `${(Number(layer.dataset.cell) - firstCell) * 60}ms` : "";
              layer.dataset.place = placeOf(layer, index);
            });
          };

          const showChapter = (index: number) => {
            if (index === active) return;
            const previous = active;
            active = index;
            // Only slots whose value changes move, cascading left to right.
            // Unchanged slots keep any in-flight transition: it already targets the same place.
            moveLayers(index, layers.filter((layer) => placeOf(layer, index) !== placeOf(layer, previous)), !reduce);
          };

          entries.forEach((entry, i) => {
            ScrollTrigger.create({
              trigger: entry,
              start: CHAPTER_LINE,
              onEnter: () => showChapter(i),
              onLeaveBack: () => showChapter(Math.max(0, i - 1)),
            });
          });

          // --- Track, nodes and entrances.
          gsap.set(svg, { autoAlpha: 1 });
          if (reduce) {
            gsap.set([...items, ...fills], { autoAlpha: 1 });
            return () => moveLayers(0, layers, false);
          }

          if (track && line) {
            gsap.fromTo(
              line,
              { drawSVG: "0%" },
              {
                drawSVG: "100%",
                ease: "none",
                scrollTrigger: { trigger: track, start: `top ${TIP}`, end: `bottom ${TIP}`, scrub: true },
              },
            );
          }

          // One batched set (all reads, then all writes) rather than one per node.
          gsap.set(fills, { autoAlpha: 1, scale: 0 });
          entries.forEach((entry) => {
            const node = entry.querySelector("[data-tl-node]");
            const fill = entry.querySelector("[data-tl-fill]");
            const ring = entry.querySelector("[data-tl-ring]");
            if (!node || !fill || !ring) return;
            const fillIn = gsap.to(fill, { scale: 1, duration: DURATION.fast, ease: EASE.out, paused: true });
            const pulse = gsap.fromTo(
              ring,
              { scale: 1, opacity: 0.9 },
              { scale: 3.4, opacity: 0, duration: DURATION.slow, ease: EASE.out, paused: true, immediateRender: false },
            );
            ScrollTrigger.create({
              trigger: node,
              start: `center ${TIP}`,
              onEnter: () => {
                fillIn.play();
                if (pulse.progress() === 0) pulse.play(); // the ring pulses only the first time
              },
              onLeaveBack: () => fillIn.reverse(),
            });
          });

          gsap.set(items, { autoAlpha: 0 });
          ScrollTrigger.batch(items, {
            start: "top 90%",
            once: true,
            onEnter: safe((batch: Element[]) => {
              gsap.to(batch, { autoAlpha: 1, duration: 0.3, ease: EASE.out, stagger: 0.05, overwrite: true });
            }),
          });

          return () => moveLayers(0, layers, false);
        },
      );
    },
    { scope: root },
  );

  return (
    <div ref={root} className={className}>
      {children}
    </div>
  );
}
