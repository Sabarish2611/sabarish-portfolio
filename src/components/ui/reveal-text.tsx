"use client";

import { useRef, type ElementType, type ReactNode } from "react";
import { DURATION, EASE, gsap, settlePendingTriggers, SplitText, useGSAP } from "@/lib/gsap";
import { hideHighlights, highlightTimeline } from "@/lib/highlight";
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
 * The site's standard text entrance: lines rise out of a mask as the block scrolls into view, then
 * any `.hl[data-hl]` phrase inside gets its highlighter wipe (lib/highlight.ts). Re-splits on
 * resize/font load (autoSplit); static under reduced motion; readable without JS.
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
        // Once the entrance has played, a re-split (resize, font swap) shows its end state. Handing
        // SplitText a new timeline would sync it to the old one's time, and with more lines the
        // highlight sits later, so its bar would flash back in.
        let played = false;
        SplitText.create(el, {
          type: "lines",
          mask: "lines",
          linesClass: "reveal-line",
          aria,
          autoSplit: true,
          onSplit: (self) => {
            gsap.set(el, { autoAlpha: 1 });
            if (!intro) settlePendingTriggers();
            // Every re-split rebuilds the phrases, so look them up here rather than once.
            const highlights = Array.from(el.querySelectorAll("[data-hl]"));
            hideHighlights(highlights);
            const reveal = gsap
              .timeline({
                delay,
                paused: intro || played,
                scrollTrigger: intro || played ? undefined : { trigger: el, start, once: true },
              })
              .from(self.lines, { yPercent: 110, duration: DURATION.slow, ease: EASE.out, stagger: 0.08 });
            if (highlights.length) reveal.add(highlightTimeline(highlights), 0.45 + self.lines.length * 0.08);
            if (played) {
              reveal.progress(1);
              return;
            }
            reveal.eventCallback("onComplete", () => {
              played = true;
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
