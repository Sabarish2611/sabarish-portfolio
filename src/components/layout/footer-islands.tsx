"use client";

import { useLenis } from "lenis/react";
import { useRef, type MouseEvent } from "react";
import { glideTo } from "@/lib/glide";
import { gsap, useGSAP } from "@/lib/gsap";

/** The site's one glide (distance-aware, instant under reduced motion), to the very top. */
export function BackToTop() {
  const lenis = useLenis();

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    glideTo(lenis, 0);
    // Keyboard activation (detail 0): continue tabbing from the top of the page, not the footer.
    if (event.detail === 0) {
      document.querySelector<HTMLElement>("header a[href='/']")?.focus({ preventScroll: true });
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="eyebrow group inline-flex h-11 items-center gap-2.5 rounded-full border border-line-strong px-5 whitespace-nowrap text-fg transition-colors duration-300 hover:border-fg"
    >
      Back to top
      <span aria-hidden className="transition-[translate] duration-500 ease-out group-hover:-translate-y-0.5">
        ↑
      </span>
    </button>
  );
}

/**
 * The closing wordmark, sized in container units so it always spans the page container exactly,
 * and clipped at the bottom so it sinks into the copyright rule. It rises as the footer scrolls in.
 */
export function FooterWordmark({ text }: { text: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const wrap = ref.current;
      const footer = wrap?.closest("footer");
      if (!wrap || !footer) return;
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        // From the moment the wordmark peeks in until the page bottom, so the rise is actually seen.
        gsap.fromTo(
          "[data-wordmark]",
          { yPercent: 45 },
          {
            yPercent: 0,
            ease: "none",
            scrollTrigger: { trigger: wrap, start: "top bottom", endTrigger: footer, end: "bottom bottom", scrub: true },
          },
        );
      });
    },
    { scope: ref },
  );

  return (
    <div ref={ref} aria-hidden className="@container">
      <div className="h-[0.675em] overflow-hidden text-[length:22.1cqi]">
        <p data-wordmark className="-ml-[0.035em] font-serif leading-none tracking-[-0.04em] whitespace-nowrap select-none">
          {text}
        </p>
      </div>
    </div>
  );
}
