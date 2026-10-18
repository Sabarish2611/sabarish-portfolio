"use client";

import { useRef, type ElementType, type ReactNode } from "react";
import { DURATION, EASE, gsap, ScrollTrigger, SplitText, useGSAP } from "@/lib/gsap";
import { onIntroReveal } from "@/lib/intro";

type RevealTextProps = {
  as?: "h1" | "h2" | "h3" | "p" | "div" | "span" | "blockquote";
  children: ReactNode;
  className?: string;
  id?: string;
  /** Seconds, after the element scrolls into view. */
  delay?: number;
  /** ScrollTrigger start. */
  start?: string;
  /**
   * Above-the-fold text: play when the preloader curtain lifts instead of on scroll, so a
   * first visit doesn't spend the reveal underneath the intro.
   */
  intro?: boolean;
};

/**
 * GSAP 3.15 workaround. A new ScrollTrigger force-refreshes the timeline-attached triggers still
 * waiting for their first tick (the project cards' entrances), and the `once` ones that fire in
 * that loop splice the array it is walking: a TypeError that takes the page down whenever it is set
 * up scrolled past them (a /#contact link, a reload mid-page). Initialized in order first, they
 * leave that loop nothing to do.
 */
function settlePendingTriggers() {
  for (const trigger of ScrollTrigger.getAll()) if (!trigger.end) trigger.refresh();
}

/**
 * The site's standard text entrance: lines rise out of a mask as the block scrolls into view.
 * Re-splits on resize/font load (autoSplit); static under reduced motion; readable without JS.
 */
export function RevealText({
  as = "p",
  children,
  className,
  id,
  delay = 0,
  start = "top 85%",
  intro = false,
}: RevealTextProps) {
  const ref = useRef<HTMLElement>(null);
  const Tag = as as ElementType;
  // SplitText's default moves the text into an aria-label and hides the lines. Headings may be
  // named that way; a <p> (or div, span…) can't, so screen readers would find it empty. Line
  // splits keep whole words, so the split text itself reads correctly.
  const aria = as === "h1" || as === "h2" || as === "h3" ? "auto" : "none";

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        let stopIntro = () => {};
        SplitText.create(el, {
          type: "lines",
          mask: "lines",
          linesClass: "reveal-line",
          aria,
          autoSplit: true,
          onSplit: (self) => {
            gsap.set(el, { autoAlpha: 1 });
            if (!intro) settlePendingTriggers();
            const reveal = gsap.from(self.lines, {
              yPercent: 110,
              duration: DURATION.slow,
              ease: EASE.out,
              stagger: 0.08,
              delay,
              paused: intro,
              scrollTrigger: intro ? undefined : { trigger: el, start, once: true },
            });
            if (intro) {
              stopIntro();
              stopIntro = onIntroReveal(() => reveal.play());
            }
            return reveal;
          },
        });
        return () => stopIntro();
      });
      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set(el, { autoAlpha: 1 });
      });
    },
    { scope: ref },
  );

  return (
    <Tag ref={ref} id={id} data-reveal="" className={className}>
      {children}
    </Tag>
  );
}
