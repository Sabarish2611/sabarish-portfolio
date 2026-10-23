"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/hooks/use-media-query";
import { cn } from "@/lib/cn";

type Particle = { fromX: number; fromY: number; toX: number; toY: number; size: number; duration: number };
type Burst = { id: number; particles: Particle[]; last: number };

const PARTICLE_COUNT = 12;
const RESET_MS = 2200;
const EASE_OUT = [0.16, 1, 0.3, 1] as const;
const LABEL_SPRING = { type: "spring", visualDuration: 0.35, bounce: 0 } as const;

/** Particles leave from the pill's outline (an ellipse of its size) and fly outward. Runs in the click handler only. */
function createBurst(id: number, width: number, height: number): Burst {
  const rx = width / 2;
  const ry = height / 2;
  const particles = Array.from({ length: PARTICLE_COUNT }, (_, i) => {
    const angle = ((i + (Math.random() - 0.5) * 0.7) / PARTICLE_COUNT) * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const travel = 18 + Math.random() * 26;
    return {
      fromX: cos * rx * 0.9,
      fromY: sin * ry * 0.9,
      toX: cos * (rx + travel),
      toY: sin * (ry + travel),
      size: 4 + Math.random() * 3,
      duration: 0.7 + Math.random() * 0.25,
    };
  });
  const last = particles.reduce((max, p, i) => (p.duration > particles[max].duration ? i : max), 0);
  return { id, particles, last };
}

function MailIcon() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} className="size-3.5 shrink-0">
      <rect x="1.75" y="3.25" width="12.5" height="9.5" rx="1.75" />
      <path d="m2.5 4.75 5.5 4 5.5-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} className="size-3.5 shrink-0">
      <path d="M3 8.5 6.5 12 13 4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * "Copy email" pill for the address, with the envelope as the email's mark among Contact's links:
 * label swap, a small accent burst on success and a polite screen-reader announcement. If the Clipboard API is unavailable or refuses, it opens the mail
 * client instead so the click is never a dead end.
 */
export function CopyEmail({ email, className }: { email: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const button = useRef<HTMLButtonElement>(null);
  const resetTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const burstId = useRef(0);
  const reduce = useReducedMotion();

  // Routes hidden by <Activity> run this cleanup too: drop the transient state with the timer so the
  // pill never comes back stuck on "Copied" (or with a half-played burst).
  useEffect(() => {
    return () => {
      clearTimeout(resetTimer.current);
      setCopied(false);
      setBursts([]);
    };
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(email);
    } catch {
      window.location.href = `mailto:${email}`;
      return;
    }
    setCopied(true);
    clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setCopied(false), RESET_MS);

    const rect = button.current?.getBoundingClientRect();
    if (reduce || !rect) return;
    burstId.current += 1;
    const burst = createBurst(burstId.current, rect.width, rect.height);
    setBursts((current) => [...current, burst]);
  }

  function removeBurst(id: number) {
    setBursts((current) => current.filter((burst) => burst.id !== id));
  }

  return (
    <span className={cn("relative inline-flex", className)}>
      <button
        ref={button}
        type="button"
        onClick={copy}
        className={cn(
          "eyebrow inline-flex h-11 items-center px-5 transition-[color,scale] duration-300 ease-out active:scale-[0.97]",
          // Cut-corner hairline; once copied, a solid accent fill (both drawn behind the label).
          copied ? "chamfer-fill text-on-accent" : "chamfer-outline text-fg hover:[--outline:var(--fg)]",
        )}
      >
        <span className="sr-only">Copy email address</span>
        <span aria-hidden className="relative grid overflow-hidden py-1">
          {/* Sizer: the pill keeps the width of its longest label, so the swap never reflows the row. */}
          <span className="invisible col-start-1 row-start-1 flex items-center justify-self-center gap-2">
            <MailIcon />
            Copy email
          </span>
          <AnimatePresence initial={false}>
            <motion.span
              key={copied ? "copied" : "copy"}
              className="col-start-1 row-start-1 flex items-center justify-self-center gap-2"
              initial={{ y: "110%", opacity: 0 }}
              animate={{ y: "0%", opacity: 1 }}
              exit={{ y: "-110%", opacity: 0 }}
              transition={LABEL_SPRING}
            >
              {copied ? <CheckIcon /> : <MailIcon />}
              {copied ? "Copied" : "Copy email"}
            </motion.span>
          </AnimatePresence>
        </span>
      </button>

      <span aria-hidden className="pointer-events-none absolute top-1/2 left-1/2 z-10">
        {bursts.map((burst) => (
          <span key={burst.id}>
            {burst.particles.map((particle, i) => (
              <motion.span
                key={i}
                className="absolute rounded-full bg-accent-ink"
                style={{
                  width: particle.size,
                  height: particle.size,
                  marginLeft: -particle.size / 2,
                  marginTop: -particle.size / 2,
                }}
                initial={{ x: particle.fromX, y: particle.fromY, scale: 1, opacity: 1 }}
                animate={{ x: particle.toX, y: particle.toY, scale: [1, 1, 0], opacity: [1, 1, 0] }}
                transition={{
                  duration: particle.duration,
                  ease: EASE_OUT,
                  scale: { duration: particle.duration, times: [0, 0.5, 1], ease: "easeIn" },
                  opacity: { duration: particle.duration, times: [0, 0.75, 1], ease: "linear" },
                }}
                onAnimationComplete={i === burst.last ? () => removeBurst(burst.id) : undefined}
              />
            ))}
          </span>
        ))}
      </span>

      <span role="status" aria-live="polite" className="sr-only">
        {copied ? "Email copied to clipboard" : ""}
      </span>
    </span>
  );
}
