"use client";

import { useRef, type ReactNode } from "react";
import { DURATION, EASE, gsap, ScrollTrigger, settlePendingTriggers, useGSAP } from "@/lib/gsap";

/**
 * Phones: the viewport line the drawn line's tip rides on. The scrub maps the rail's top→bottom onto
 * this line, so a node fills exactly when its centre crosses it — no measuring needed.
 */
const TIP = "70%";

/** Wider screens: how long the path takes to draw from the first stop to "Now", once, on arrival (s). */
const DRAW = 1.6;

/**
 * Client-only behaviour for the server-rendered Experience markup, wired through data-tl-* attributes.
 * Phones: the vertical rail draws as you scroll and each node fills when the line reaches it; entries
 * fade in as they arrive. Wider screens fit the whole timeline on one screen, so the path draws along
 * the axis once when it comes into view: at each stop the node fills, its stem grows out of the axis
 * and its text rises in; at the end the "Now" marker lands and pulses a few times. Reduced motion:
 * the final state (line drawn, nodes filled, everything shown), 200ms fades.
 */
export function TimelineMotion({ children, className }: { children: ReactNode; className?: string }) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    (gsapContext) => {
      const el = root.current;
      if (!el) return;
      const all = (selector: string) => gsap.utils.toArray<HTMLElement>(selector, el);

      // The matchMedia lives outside useGSAP's context, as in playWithMotion (work/visuals/shared):
      // nested, a route hidden by React Activity reverts it twice and re-applies fromTo start values.
      let mm: gsap.MatchMedia | undefined;
      gsapContext.ignore(() => {
        mm = gsap.matchMedia(el);
        mm.add(
          // GSAP runs the callback only while at least one condition matches: `motion` makes sure one
          // always does (phones with motion on match neither `reduce` nor `wide`).
          {
            reduce: "(prefers-reduced-motion: reduce)",
            motion: "(prefers-reduced-motion: no-preference)",
            wide: "(min-width: 48rem)",
          },
          (context, contextSafe) => {
            // Tweens made later (ScrollTrigger callbacks) still belong to this context. The core
            // typing is (Function) => Function, so restore the wrapped signature.
            const safe = <A extends unknown[]>(fn: (...args: A) => void) =>
              (contextSafe ? contextSafe(fn) : fn) as (...args: A) => void;
            const { reduce, wide } = context.conditions as { reduce: boolean; wide: boolean };
            const track = el.querySelector<HTMLElement>(`[data-tl-track="${wide ? "x" : "y"}"]`);
            const line = track?.querySelector("[data-tl-line]");
            const items = all("[data-tl-item]");
            const fills = all("[data-tl-fill]");
            const now = all("[data-tl-now]");
            const nowLabel = all("[data-tl-now-label]");
            const next = all("[data-tl-next]");

            gsap.set(all("[data-tl-svg]"), { autoAlpha: 1 });
            if (reduce) {
              gsap.set([...items, ...fills, ...now, ...nowLabel, ...next], { autoAlpha: 1 });
              return;
            }

            // Each node fills (and its ring pulses, the first time) when the drawn line reaches it.
            gsap.set(fills, { autoAlpha: 1, scale: 0 });
            const stops = all("[data-tl-entry]").flatMap((entry) => {
              const node = entry.querySelector<HTMLElement>("[data-tl-node]");
              const fill = entry.querySelector("[data-tl-fill]");
              const ring = entry.querySelector("[data-tl-ring]");
              if (!node || !fill || !ring) return [];
              const fillIn = gsap.to(fill, { scale: 1, duration: DURATION.fast, ease: EASE.out, paused: true });
              const pulse = gsap.fromTo(
                ring,
                { scale: 1, opacity: 0.9 },
                { scale: 3.4, opacity: 0, duration: DURATION.slow, ease: EASE.out, paused: true, immediateRender: false },
              );
              const arrive = () => {
                fillIn.play();
                if (pulse.progress() === 0) pulse.play();
              };
              return [{ entry, node, fillIn, arrive }];
            });

            // Text that enters with its stop rather than on its own.
            const staged = new Set<HTMLElement>();
            let played: gsap.core.Timeline | undefined;

            if (track && line && wide) {
              // Drawn along once, in step: each stop comes in as the line passes its node.
              const draw = gsap
                .timeline({ paused: true })
                .fromTo(line, { drawSVG: "0%" }, { drawSVG: "100%", duration: DRAW, ease: "none" }, 0);
              const rail = track.getBoundingClientRect();
              stops.forEach(({ entry, node, arrive }) => {
                const box = node.getBoundingClientRect();
                const at = DRAW * Math.min(1, Math.max(0, (box.left + box.width / 2 - rail.left) / rail.width));
                const text = gsap.utils.toArray<HTMLElement>("[data-tl-item]", entry);
                text.forEach((item) => staged.add(item));
                draw
                  .add(arrive, at)
                  .fromTo(
                    entry.querySelector("[data-tl-pole]"),
                    { scaleY: 0 },
                    { scaleY: 1, duration: DURATION.base, ease: EASE.out },
                    at,
                  )
                  // Opacity, not autoAlpha: the case-study links stay in the tab order before it plays.
                  .fromTo(
                    text,
                    { opacity: 0, y: 12 },
                    { opacity: 1, y: 0, duration: DURATION.base, ease: EASE.out, stagger: 0.06 },
                    at + 0.15,
                  );
              });
              // Today: the marker lands where the path ends and pulses a few times (not forever); the
              // dashed line on into what's next fades in behind it.
              draw
                .fromTo(now, { autoAlpha: 0, scale: 0 }, { autoAlpha: 1, scale: 1, duration: DURATION.fast, ease: EASE.out }, DRAW)
                .fromTo([...nowLabel, ...next], { autoAlpha: 0 }, { autoAlpha: 1, duration: DURATION.base, ease: EASE.out }, DRAW)
                .fromTo(
                  all("[data-tl-now-ring]"),
                  { scale: 1, opacity: 0.9 },
                  { scale: 3.2, opacity: 0, duration: DURATION.slow, ease: EASE.out, repeat: 2, immediateRender: false },
                  DRAW + 0.1,
                );
              settlePendingTriggers();
              played = draw;
              ScrollTrigger.create({ trigger: track, start: "top 80%", once: true, onEnter: () => draw.play() });
            } else if (track && line) {
              gsap.fromTo(
                line,
                { drawSVG: "0%" },
                {
                  drawSVG: "100%",
                  ease: "none",
                  scrollTrigger: { trigger: track, start: `top ${TIP}`, end: `bottom ${TIP}`, scrub: true },
                },
              );
              stops.forEach(({ node, fillIn, arrive }) => {
                ScrollTrigger.create({
                  trigger: node,
                  start: `center ${TIP}`,
                  onEnter: arrive,
                  onLeaveBack: () => fillIn.reverse(),
                });
              });
            }

            const rest = items.filter((item) => !staged.has(item));
            gsap.set(rest, { opacity: 0 });
            // Every start state is applied: show the text to assistive tech and the tab order now.
            gsap.set(items, { visibility: "visible" });
            settlePendingTriggers();
            ScrollTrigger.batch(rest, {
              start: "top 90%",
              once: true,
              onEnter: safe((batch: Element[]) => {
                gsap.to(batch, { opacity: 1, duration: 0.3, ease: EASE.out, stagger: 0.05, overwrite: true });
              }),
            });

            // Tabbing to a case-study link before its stop has come in: the path finishes drawing at
            // once (callbacks on, so the nodes fill), and on phones the focused stop shows.
            const finish = safe((event: FocusEvent) => {
              played?.progress(1, false);
              const entry = (event.target as Element).closest("[data-tl-entry]");
              const shown = entry ? rest.filter((item) => entry.contains(item)) : [];
              if (shown.length) gsap.to(shown, { opacity: 1, duration: 0.2, ease: EASE.out, overwrite: true });
            });
            el.addEventListener("focusin", finish);
            return () => el.removeEventListener("focusin", finish);
          },
        );
      });
      return () => mm?.revert();
    },
    { scope: root },
  );

  return (
    <div ref={root} className={className}>
      {children}
    </div>
  );
}
