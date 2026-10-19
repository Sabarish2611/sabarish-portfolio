"use client";

import { useRef } from "react";
import { cn } from "@/lib/cn";
import { gsap, useGSAP } from "@/lib/gsap";

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/**
 * A short mono label that decodes into place as it scrolls into view: it shows scrambled glyphs of
 * the same length (so a mono line keeps its width), then resolves left to right. The real text is
 * rendered on the server and kept for assistive tech in a visually hidden copy; the animated copy is
 * aria-hidden. Static under reduced motion. Started by an IntersectionObserver, not a ScrollTrigger:
 * a dozen of these would otherwise add a dozen triggers (and their refreshes) to every page load.
 */
export function DecodeText({ children, className }: { children: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const scrambled = children.replace(/\S/g, () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)]);
        el.textContent = scrambled;
        const tween = gsap.to(el, {
          duration: 0.9,
          ease: "none",
          paused: true,
          scrambleText: { text: children, chars: GLYPHS, revealDelay: 0.15, speed: 0.7 },
        });
        // Plays once the label is 8% up from the bottom of the viewport ("top 92%").
        const observer = new IntersectionObserver(
          ([entry]) => {
            if (!entry?.isIntersecting) return;
            observer.disconnect();
            tween.play();
          },
          { rootMargin: "0px 0px -8% 0px" },
        );
        observer.observe(el);
        return () => {
          observer.disconnect();
          tween.kill();
          el.textContent = children;
        };
      });
    },
    { scope: ref, dependencies: [children] },
  );

  return (
    <span className={cn("relative", className)}>
      <span ref={ref} aria-hidden>
        {children}
      </span>
      <span className="sr-only">{children}</span>
    </span>
  );
}
