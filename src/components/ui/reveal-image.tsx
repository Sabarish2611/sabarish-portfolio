"use client";

import Image, { type StaticImageData } from "next/image";
import { useRef } from "react";
import { cn } from "@/lib/cn";
import { DURATION, EASE, gsap, settlePendingTriggers, useGSAP } from "@/lib/gsap";

type RevealImageProps = {
  /** A static import: width, height and the blur placeholder come with it. */
  src: StaticImageData;
  alt: string;
  /**
   * How wide the photo renders, for the srcset. It covers a layer 1.16× the card's height, so a
   * photo with the card's aspect ratio renders 1.16× the card's width.
   */
  sizes: string;
  /** The card: size, aspect ratio, grid placement, corner cut (--cut). */
  className?: string;
  /** ScrollTrigger start. */
  start?: string;
};

/**
 * A photo card: two corners cut (the chamfer utility), the photo graded black-and-white with film
 * grain over it. The image counterpart of RevealText: the frame wipes open upward as it scrolls into
 * view while the photo settles from a slight zoom, then drifts inside the card with the scroll.
 *
 * Layered so no two effects fight over a property: the card holds the static corner clip, the
 * frame takes the animated wipe clip, the layer the drift (it overhangs by 8% top and bottom, more
 * than the drift, so its edges never show). The hover lean-in sits on an element of its own: GSAP
 * writes inline transforms (including `scale`) on the layer and the img it animates. In the light
 * theme a hairline traces the cut shape (the card's background, 1px around an inner clip), since a
 * bright sky would otherwise melt into the page.
 * Static under reduced motion; visible without JS.
 */
export function RevealImage({ src, alt, sizes, className, start = "top 85%" }: RevealImageProps) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const card = ref.current;
      const frame = card?.querySelector<HTMLElement>("[data-reveal-image-frame]");
      const layer = frame?.querySelector<HTMLElement>("[data-reveal-image-layer]");
      const image = layer?.querySelector("img");
      if (!card || !frame || !layer || !image) return;
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        settlePendingTriggers();
        gsap
          .timeline({ scrollTrigger: { trigger: card, start, once: true } })
          .fromTo(
            frame,
            { clipPath: "inset(100% 0% 0% 0%)" },
            { clipPath: "inset(0% 0% 0% 0%)", duration: DURATION.slower, ease: EASE.inOut },
          )
          .from(image, { scale: 1.2, duration: DURATION.slower + 0.4, ease: EASE.out }, 0);
        gsap.set(card, { autoAlpha: 1 });

        gsap.fromTo(
          layer,
          { yPercent: -6 },
          {
            yPercent: 6,
            ease: "none",
            scrollTrigger: { trigger: card, start: "top bottom", end: "bottom top", scrub: true },
          },
        );
      });

      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set(card, { autoAlpha: 1 });
      });
    },
    { scope: ref },
  );

  return (
    <div ref={ref} data-reveal="" className={cn("group chamfer relative light:bg-line-strong", className)}>
      <div className="chamfer absolute inset-px bg-bg">
        <div data-reveal-image-frame className="absolute inset-0 overflow-hidden bg-bg-sunken">
          <div data-reveal-image-layer className="absolute inset-x-0 -top-[8%] -bottom-[8%] will-change-transform">
            <div className="absolute inset-0 transition-[scale] duration-[1.4s] ease-out motion-safe:group-hover:scale-[1.04]">
              <Image src={src} alt={alt} fill sizes={sizes} placeholder="blur" className="object-cover" />
            </div>
          </div>
          <span aria-hidden className="photo-noise pointer-events-none absolute inset-0" />
        </div>
      </div>
      {/* Neutral lock-on brackets on hover (the photo isn't a link, so no accent). */}
      <span
        aria-hidden
        className="detect-brackets pointer-events-none absolute inset-3 scale-[1.03] text-fg opacity-0 transition-[opacity,scale] duration-500 ease-out group-hover:scale-100 group-hover:opacity-70 motion-reduce:scale-100"
      />
    </div>
  );
}
