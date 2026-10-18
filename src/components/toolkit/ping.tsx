"use client";

import { useEffect, useRef, type ComponentProps } from "react";
import { cn } from "@/lib/cn";
import { onIntroReveal } from "@/lib/intro";

// Tailwind's animate-ping, run through WAAPI so it can be bounded.
const PING: Keyframe[] = [
  { transform: "scale(1)", opacity: 0.6 },
  { transform: "scale(2)", opacity: 0, offset: 0.75 },
  { transform: "scale(2)", opacity: 0 },
];
const PINGS = 3;

/**
 * A live-signal dot whose halo pings a few times each time it comes into view (after the intro),
 * then rests. Never an endless loop: a ping that keeps running offscreen or under a faded parent
 * falls back to the main thread and repaints the page every frame. Static under reduced motion.
 * The wrapper must be positioned (pass `relative` or `absolute …` in className).
 */
export function PingDot({
  className,
  delay = 0,
  ...rest
}: ComponentProps<"span"> & {
  /** Milliseconds before the first ping, to land after the dot's own entrance. */
  delay?: number;
}) {
  const halo = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = halo.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let animation: Animation | undefined;
    let wait = delay;
    const observer = new IntersectionObserver((entries) => {
      animation?.cancel();
      if (!entries[entries.length - 1]?.isIntersecting) return;
      animation = el.animate(PING, { duration: 1000, iterations: PINGS, delay: wait, easing: "cubic-bezier(0, 0, 0.2, 1)" });
      wait = 0;
    });
    const stopReveal = onIntroReveal(() => observer.observe(el));
    return () => {
      stopReveal();
      observer.disconnect();
      animation?.cancel();
    };
  }, [delay]);

  return (
    <span aria-hidden className={cn("flex size-2", className)} {...rest}>
      <span ref={halo} className="absolute inset-0 rounded-full bg-accent-ink opacity-0" />
      <span className="relative size-2 rounded-full bg-accent-ink" />
    </span>
  );
}
