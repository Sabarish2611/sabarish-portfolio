"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { EASE, gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";

/**
 * Bento shell. Tiles (`[data-tile]`) fade in (opacity only), batched, as they scroll into view. With a mouse, the
 * hovered tile receives the pointer position as --mx/--my for its spotlight: one delegated listener,
 * at most one style write per frame, no React state.
 */
export function BentoGrid({ children, className }: { children: ReactNode; className?: string }) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const tiles = gsap.utils.toArray<HTMLElement>("[data-tile]");
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.set(tiles, { autoAlpha: 0 });
        ScrollTrigger.batch(tiles, {
          start: "top 90%",
          once: true,
          interval: 0.1,
          onEnter: (batch) =>
            gsap.to(batch, {
              autoAlpha: 1,
              duration: 0.3,
              ease: EASE.out,
              stagger: 0.05,
              overwrite: true,
            }),
        });
      });

      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set(tiles, { autoAlpha: 1 });
      });
    },
    { scope: root },
  );

  useEffect(() => {
    const grid = root.current;
    if (!grid) return;
    let frame = 0;
    let tile: HTMLElement | null = null;
    let x = 0;
    let y = 0;

    const paint = () => {
      frame = 0;
      if (!tile) return;
      const rect = tile.getBoundingClientRect();
      tile.style.setProperty("--mx", `${Math.round(x - rect.left)}px`);
      tile.style.setProperty("--my", `${Math.round(y - rect.top)}px`);
    };

    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || !(event.target instanceof Element)) return;
      tile = event.target.closest<HTMLElement>("[data-tile]");
      x = event.clientX;
      y = event.clientY;
      if (!frame) frame = requestAnimationFrame(paint);
    };

    grid.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      grid.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={root} className={cn("grid grid-cols-1 gap-3 md:grid-cols-6 md:gap-4 lg:grid-cols-12", className)}>
      {children}
    </div>
  );
}
