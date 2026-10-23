"use client";

import { createContext, use, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";
import { readPaused, subscribePaused, writePaused } from "@/lib/motion-pause";

/** A ticker entry: plain text, or a mark (a logo) standing for its label. */
export type MarqueeItem = string | { label: string; mark: ReactNode };

type MarqueeProps = {
  items: readonly MarqueeItem[];
  /** Accessible name of the list. The items are announced once; the loop copy is hidden. */
  ariaLabel: string;
  /** Travel left-to-right instead of right-to-left. */
  reverse?: boolean;
  /** Seconds for one loop (one copy of the list, repeats included) at rest. */
  speed?: number;
  /**
   * Show each item's mark alone, in a 1em square (give it size-full), its label kept for screen
   * readers. Every item needs a mark.
   */
  logos?: boolean;
  /** Times the list repeats in each copy, so a short list still spans the widest screens. */
  repeat?: number;
  /** Row typography and colour. Spacing and the separator are em-based, so they scale with it. */
  className?: string;
};

/** Scroll speed (px/s) that adds +1x to the loop, the cap on that boost, and the hover speed. */
const VELOCITY_PER_BOOST = 2400;
const MAX_BOOST = 1.5;
const HOVER_SPEED = 0.2;

const PausedContext = createContext(false);

function PlaybackIcon({ paused }: { paused: boolean }) {
  return (
    <svg aria-hidden viewBox="0 0 10 10" className="size-2.5 shrink-0 fill-current">
      {paused ? <path d="M2 1.2v7.6L8.8 5z" /> : <path d="M2 1h2.2v8H2zM5.8 1H8v8H5.8z" />}
    </svg>
  );
}

/**
 * Marquee rows with one shared pause/play control. The choice persists, and keyboard focus inside
 * the group (on the control) holds the rows still too. Reduced motion: the rows are static lists,
 * so the control is hidden.
 */
export function MarqueeGroup({
  label,
  children,
  className,
}: {
  /** Completes the control's accessible name: "Pause {label}" / "Play {label}". */
  label: string;
  children: ReactNode;
  className?: string;
}) {
  const paused = useSyncExternalStore(subscribePaused, readPaused, () => false);
  const [held, setHeld] = useState(false);

  return (
    <div
      className={className}
      onFocus={() => setHeld(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setHeld(false);
      }}
    >
      <div className="container-page flex items-center gap-4">
        <span aria-hidden className="h-px flex-1 bg-line" />
        <button
          type="button"
          // An explicit choice overrides the focus hold, so "Play" plays even while focused. Below md an
          // invisible ::after (::before draws the outline) stretches the 40px button to a 44px tap target.
          onClick={() => {
            setHeld(false);
            writePaused(!paused);
          }}
          className="eyebrow inline-flex h-10 chamfer-outline items-center gap-2.5 px-4 text-fg-muted transition-colors duration-300 after:absolute after:inset-x-0 after:-inset-y-0.5 hover:text-fg hover:[--outline:var(--fg)] motion-reduce:hidden md:h-8 md:px-3.5 md:after:hidden"
        >
          <PlaybackIcon paused={paused} />
          {paused ? "Play" : "Pause"}
          <span className="sr-only"> {label}</span>
        </button>
      </div>
      <PausedContext value={paused || held}>{children}</PausedContext>
    </div>
  );
}

/**
 * Infinite ticker. The list renders twice and the track slides -50% on a GSAP loop, so it can
 * speed up with scroll velocity, turn around when the scroll does, ease down under the mouse, ease
 * to a stop when paused (see MarqueeGroup) and pause offscreen. With reduced motion it is a static, wrapping list (pure CSS,
 * so nothing flashes on hydration). One copy of the list must be wider than the viewport for the
 * loop to stay seamless: `repeat` a short one.
 */
export function Marquee({
  items,
  ariaLabel,
  reverse = false,
  speed = 40,
  logos = false,
  repeat = 1,
  className,
}: MarqueeProps) {
  const root = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const paused = use(PausedContext);
  const pausedRef = useRef(paused);
  const syncPlayback = useRef<() => void>(undefined);

  useEffect(() => {
    pausedRef.current = paused;
    syncPlayback.current?.();
  }, [paused]);

  useGSAP(
    () => {
      const el = root.current;
      const trackEl = track.current;
      if (!el || !trackEl) return;
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const loop = gsap.fromTo(
          trackEl,
          { xPercent: reverse ? -50 : 0 },
          { xPercent: reverse ? 0 : -50, duration: speed, ease: "none", repeat: -1, paused: true },
        );
        // Start deep into the repeats, so a negative time scale (scrolling up) has room to run back.
        loop.totalTime(speed * 1000);

        // Four independent speed factors. quickTo re-targets a single tween per factor, so the
        // handlers below never create animations outside this context. `direction` eases through 0
        // when the scroll turns around, so the row slows, stops and heads the other way.
        const hover = { value: 1 };
        const scroll = { value: 1 };
        const motion = { value: pausedRef.current ? 0 : 1 };
        const direction = { value: 1 };
        const apply = () => loop.timeScale(hover.value * scroll.value * motion.value * direction.value);
        const toHover = gsap.quickTo(hover, "value", { duration: 0.9, ease: "power3.out", onUpdate: apply });
        const toScroll = gsap.quickTo(scroll, "value", { duration: 0.6, ease: "power2.out", onUpdate: apply });
        const toDirection = gsap.quickTo(direction, "value", { duration: 0.9, ease: "power2.inOut", onUpdate: apply });
        const toMotion = gsap.quickTo(motion, "value", {
          duration: 0.6,
          ease: "power2.out",
          onUpdate: apply,
          // Fully stopped: stop ticking too.
          onComplete: () => {
            if (motion.value === 0) loop.pause();
          },
        });

        let inView = false;
        const sync = () => {
          if (!inView) {
            loop.pause(); // offscreen: stop outright
          } else if (pausedRef.current) {
            toMotion(0); // on screen: ease to a stop
          } else {
            loop.play();
            toMotion(1);
          }
        };
        syncPlayback.current = sync;

        ScrollTrigger.create({
          trigger: el,
          start: "top bottom",
          end: "bottom top",
          onToggle: (self) => {
            inView = self.isActive;
            sync();
          },
          onUpdate: (self) => {
            toScroll(1 + Math.min(Math.abs(self.getVelocity()) / VELOCITY_PER_BOOST, MAX_BOOST));
            toDirection(self.direction);
          },
        });

        const settle = () => toScroll(1);
        const slowDown = (event: PointerEvent) => {
          if (event.pointerType === "mouse") toHover(HOVER_SPEED);
        };
        const speedUp = () => toHover(1);
        ScrollTrigger.addEventListener("scrollEnd", settle);
        el.addEventListener("pointerenter", slowDown);
        el.addEventListener("pointerleave", speedUp);

        return () => {
          syncPlayback.current = undefined;
          ScrollTrigger.removeEventListener("scrollEnd", settle);
          el.removeEventListener("pointerenter", slowDown);
          el.removeEventListener("pointerleave", speedUp);
        };
      });
    },
    { scope: root, dependencies: [reverse, speed], revertOnUpdate: true },
  );

  return (
    <div
      ref={root}
      className={cn(
        // Vertical padding keeps ascenders/descenders inside the edge-fade mask. `relative` makes this the
        // containing block of the logos' sr-only labels, so it clips them too: otherwise, until GSAP
        // transforms the track, they widen the page to the track's full length.
        "relative overflow-hidden py-[0.2em] [mask-image:linear-gradient(90deg,transparent,#000_7%,#000_93%,transparent)]",
        "motion-reduce:container-page motion-reduce:[mask-image:none]",
        className,
      )}
    >
      <div ref={track} className="flex w-max motion-reduce:block motion-reduce:w-auto">
        <MarqueeList items={items} ariaLabel={ariaLabel} logos={logos} repeat={repeat} />
        <MarqueeList items={items} logos={logos} repeat={repeat} hidden />
      </div>
    </div>
  );
}

function MarqueeList({
  items,
  ariaLabel,
  logos,
  repeat,
  hidden = false,
}: {
  items: readonly MarqueeItem[];
  ariaLabel?: string;
  logos: boolean;
  repeat: number;
  hidden?: boolean;
}) {
  return (
    // role="list": Safari drops list semantics from list-style:none lists.
    <ul
      role="list"
      aria-label={ariaLabel}
      aria-hidden={hidden || undefined}
      className={cn(
        // Static (reduced motion): a wrapping list, spaced by the gap; separators would dangle at line ends.
        "flex shrink-0 items-center motion-reduce:flex-wrap motion-reduce:gap-y-[0.35em]",
        !logos && "motion-reduce:gap-x-[0.9em]",
        hidden && "motion-reduce:hidden",
      )}
    >
      {Array.from({ length: repeat }, (_, set) =>
        items.map((item, index) => {
          const { label, mark } = typeof item === "string" ? { label: item, mark: null } : item;
          // Repeats only fill the loop: screen readers hear the list once, and the static list shows it once.
          const extra = set > 0;
          return (
            <li
              key={`${set}-${index}`}
              aria-hidden={extra || undefined}
              className={cn(
                "flex shrink-0 items-center whitespace-nowrap",
                logos && "pr-[1.25em]",
                extra && "motion-reduce:hidden",
              )}
            >
              {logos ? (
                <>
                  <span aria-hidden className="flex size-[1em] shrink-0">
                    {mark}
                  </span>
                  <span className="sr-only">{label}</span>
                </>
              ) : (
                <>
                  {label}
                  {/* Every copy ends with a separator so the seam between the two copies is invisible. */}
                  <span
                    aria-hidden
                    className="mx-[0.55em] size-[max(6px,0.11em)] shrink-0 rotate-45 bg-fg-subtle motion-reduce:hidden"
                  />
                </>
              )}
            </li>
          );
        }),
      )}
    </ul>
  );
}
