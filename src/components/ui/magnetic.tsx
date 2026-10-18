"use client";

import { motion, useMotionValue, useSpring } from "motion/react";
import { useRef, type PointerEvent, type ReactNode } from "react";
import { useFinePointer, useReducedMotion } from "@/hooks/use-media-query";
import { cn } from "@/lib/cn";

const SPRING = { stiffness: 180, damping: 15, mass: 0.25 };

/** Pulls its child toward the pointer. Mouse/trackpad only; inert under reduced motion. */
export function Magnetic({
  children,
  strength = 0.35,
  className,
}: {
  children: ReactNode;
  strength?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const fine = useFinePointer();
  const reduce = useReducedMotion();
  const enabled = fine && !reduce;
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, SPRING);
  const springY = useSpring(y, SPRING);

  function handleMove(event: PointerEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!enabled || !el || event.pointerType !== "mouse") return;
    // Measure the static wrapper, not the moving child, or the offset feeds back on itself.
    const rect = el.getBoundingClientRect();
    x.set((event.clientX - rect.left - rect.width / 2) * strength);
    y.set((event.clientY - rect.top - rect.height / 2) * strength);
  }

  function reset() {
    x.set(0);
    y.set(0);
  }

  return (
    <div ref={ref} className={cn("inline-block", className)} onPointerMove={handleMove} onPointerLeave={reset}>
      <motion.div style={{ x: springX, y: springY }}>{children}</motion.div>
    </div>
  );
}
