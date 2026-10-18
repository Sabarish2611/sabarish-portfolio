"use client";

import { useRef, type ReactNode } from "react";
import { DURATION, EASE, gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";
import { onIntroReveal } from "@/lib/intro";

/** Secondary entrances are opacity-only and short; only masked reveals travel. */
const FADE = 0.3;

/**
 * Choreography for the server-rendered case study, keyed by data attributes:
 * - `data-cs-intro`  hero items; staggered in once the preloader curtain lifts
 * - `data-cs-rule`   hairlines that draw in from the left
 * - `data-cs-stats`  a <dl> of <Stat>s; values then labels rise out of each (clipping) cell
 * - `data-cs-steps`  approach list (`data-cs-step` rows, `data-cs-progress`)
 * - `data-cs-chips`  chips, staggered
 * - `data-cs-fade`   blocks that fade in
 * - `data-cs-rise`   a block that rises out of its overflow-clipped parent
 * Reduced motion: everything is static and visible.
 */
export function CaseStudyMotion({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = root.current;
      if (!el) return;
      const all = (selector: string, scope: Element = el) => gsap.utils.toArray<HTMLElement>(selector, scope);
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set(all("[data-cs-intro]"), { autoAlpha: 1 });
      });

      mm.add("(prefers-reduced-motion: no-preference)", (_context, contextSafe) => {
        // gsap-core types this contextSafe as (f: Function) => Function; keep each callback's signature.
        const safe = <T extends (...args: never[]) => void>(fn: T) => contextSafe!(fn) as T;
        const intro = gsap
          .timeline({ paused: true, defaults: { ease: EASE.out } })
          .fromTo(
            all("[data-cs-intro]"),
            { autoAlpha: 0 },
            { autoAlpha: 1, duration: FADE, stagger: 0.09 },
            0.2,
          );
        const stopIntro = onIntroReveal(() => intro.play());

        // Below the fold, start states apply now (before paint) but the ScrollTriggers are armed two
        // frames later: a client navigation commits while the window still has the previous page's
        // scroll position (reset in an effect right after), and triggers created there fire at once.
        const rules = all("[data-cs-rule]");
        const stepRules = all("[data-cs-step-rule]");
        const fades = all("[data-cs-fade]");
        const rises = all("[data-cs-rise]");
        const chipLists = all("[data-cs-chips]");
        const statLists = all("[data-cs-stats]");
        const steps = all("[data-cs-step]");
        const stepContent = (row: HTMLElement) => all(":scope > :not([data-cs-step-rule])", row);
        const progress = all("[data-cs-progress]")[0];
        // Each stat's value and label (value first), pushed below its cell's clipping edge. Cell
        // heights are read before anything below is written (no read-after-write reflow).
        const statParts = (list: HTMLElement) =>
          gsap.utils
            .toArray<HTMLElement>(list.children)
            .flatMap((cell) => gsap.utils.toArray<HTMLElement>(cell.children).reverse());
        const statDrops = statLists.map((list) => statParts(list).map((part) => part.parentElement?.clientHeight ?? 0));

        // Content fades are opacity-only (never autoAlpha): text waiting to scroll in stays in the
        // accessibility tree. Only the hero intro (data-reveal, revealed at load) uses autoAlpha.
        gsap.set([...rules, ...stepRules], { scaleX: 0, transformOrigin: "left center" });
        gsap.set(fades, { opacity: 0 });
        gsap.set(rises, { yPercent: 105 });
        chipLists.forEach((list) => gsap.set(list.children, { opacity: 0 }));
        statLists.forEach((list, i) => gsap.set(statParts(list), { y: (j: number) => statDrops[i][j] }));
        steps.forEach((row) => gsap.set(stepContent(row), { opacity: 0 }));
        if (progress) gsap.set(progress, { scaleX: 0, transformOrigin: "left center" });

        const once = (trigger: Element, start = "top 88%") => ({ trigger, start, once: true });

        const arm = safe(() => {
          rules.forEach((rule) => {
            gsap.to(rule, { scaleX: 1, duration: DURATION.slower, ease: EASE.inOut, scrollTrigger: once(rule, "top 92%") });
          });

          fades.forEach((item) => {
            gsap.to(item, { opacity: 1, duration: FADE, ease: EASE.out, scrollTrigger: once(item, "top 92%") });
          });

          rises.forEach((item) => {
            gsap.to(item, { yPercent: 0, duration: DURATION.slow, ease: EASE.out, scrollTrigger: once(item, "top 92%") });
          });

          chipLists.forEach((list) => {
            gsap.to(list.children, {
              opacity: 1,
              duration: FADE,
              ease: EASE.out,
              stagger: 0.035,
              scrollTrigger: once(list, "top 92%"),
            });
          });

          statLists.forEach((list) => {
            gsap.to(statParts(list), {
              y: 0,
              duration: DURATION.slow,
              ease: EASE.out,
              stagger: 0.07,
              scrollTrigger: once(list, "top 85%"),
            });
          });

          // Rows that enter together cascade: rule draws, then number, title and body fade in.
          ScrollTrigger.batch(steps, {
            start: "top 88%",
            once: true,
            onEnter: safe((batch: Element[]) => {
              batch.forEach((row, i) => {
                const rule = row.querySelector("[data-cs-step-rule]");
                const tl = gsap.timeline({ delay: i * 0.12, defaults: { ease: EASE.out } });
                if (rule) tl.to(rule, { scaleX: 1, duration: DURATION.slow, ease: EASE.inOut }, 0);
                tl.to(
                  stepContent(row as HTMLElement),
                  { opacity: 1, duration: FADE, stagger: 0.07 },
                  rule ? 0.12 : 0,
                );
              });
            }),
          });

          // The step under the reading line (60% down) is "active"; the readout line tracks progress.
          steps.forEach((row) =>
            ScrollTrigger.create({
              trigger: row,
              start: "top 60%",
              end: "bottom 60%",
              onToggle: (self) => {
                row.dataset.active = String(self.isActive);
              },
            }),
          );
          const list = all("[data-cs-steps]")[0];
          if (list && progress) {
            gsap.to(progress, {
              scaleX: 1,
              ease: "none",
              scrollTrigger: {
                trigger: list,
                start: "top 60%",
                end: "bottom 60%",
                scrub: 0.6,
              },
            });
          }
        });

        let frame = requestAnimationFrame(() => {
          frame = requestAnimationFrame(arm);
        });

        return () => {
          stopIntro();
          cancelAnimationFrame(frame);
          steps.forEach((row) => delete row.dataset.active);
        };
      });
    },
    { scope: root },
  );

  return <div ref={root}>{children}</div>;
}
