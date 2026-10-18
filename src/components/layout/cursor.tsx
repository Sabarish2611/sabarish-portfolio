"use client";

import { motion, useMotionValue, useSpring } from "motion/react";
import { useEffect, useState } from "react";
import { useFinePointer, useReducedMotion } from "@/hooks/use-media-query";
import { cn } from "@/lib/cn";
import { useMobileMenuShown } from "./mobile-menu";

type Mode = "default" | "link" | "view" | "hidden";

/** Text entry keeps the native I-beam, so the custom cursor steps aside there. */
const TEXT_FIELDS =
  "input:not([type=button],[type=submit],[type=reset],[type=checkbox],[type=radio],[type=range],[type=color],[type=file],[type=image]),textarea,[contenteditable]:not([contenteditable=false])";
const INTERACTIVE =
  "a[href],button:not(:disabled),[role=button],[role=link],[role=option],[role=tab],[role=switch],label,summary,select,input";

const DOT_SPRING = { stiffness: 800, damping: 40, mass: 0.35 };
/** Softer, so the big "View" disc trails the pointer a touch. */
const VIEW_SPRING = { stiffness: 350, damping: 34, mass: 0.6 };

const SHAPE =
  "absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 rounded-full transition-[opacity,scale] ease-out motion-reduce:transition-opacity motion-reduce:duration-150";

function resolveMode(target: EventTarget | null): Mode {
  if (!(target instanceof Element)) return "default";
  const explicit = target.closest<HTMLElement>("[data-cursor]")?.dataset.cursor;
  if (explicit === "hidden" || target.closest(TEXT_FIELDS)) return "hidden";
  if (explicit === "view") return "view";
  return target.closest(INTERACTIVE) ? "link" : "default";
}

/**
 * Pointer follower for mouse/trackpad users: a blend-mode dot that opens into a ring over anything
 * clickable and becomes a solid accent "View" disc over [data-cursor="view"]. Over text fields and
 * [data-cursor="hidden"] it hides and hands back the native cursor. Renders nothing on touch/server.
 * Mounted through <CursorLoader>, which also keeps it away from forced-colours/high-contrast users.
 */
export function Cursor() {
  const fine = useFinePointer();
  const reduce = useReducedMotion();
  const menuShown = useMobileMenuShown();
  const [mode, setMode] = useState<Mode>("default");
  const [inside, setInside] = useState(false);
  const [pressed, setPressed] = useState(false);
  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const dotX = useSpring(x, DOT_SPRING);
  const dotY = useSpring(y, DOT_SPRING);
  const viewX = useSpring(x, VIEW_SPRING);
  const viewY = useSpring(y, VIEW_SPRING);

  useEffect(() => {
    if (!fine) return;
    const root = document.documentElement;
    let tracking = false;

    function move(event: PointerEvent) {
      if (event.pointerType !== "mouse") return;
      if (tracking) {
        x.set(event.clientX);
        y.set(event.clientY);
        return;
      }
      // (Re)entering: appear under the pointer instead of sweeping in from where it left.
      tracking = true;
      for (const value of [x, dotX, viewX]) value.jump(event.clientX);
      for (const value of [y, dotY, viewY]) value.jump(event.clientY);
      setMode(resolveMode(event.target));
      setInside(true);
    }
    // pointerover bubbles, so one listener classifies everything under the pointer.
    function over(event: PointerEvent) {
      if (event.pointerType === "mouse") setMode(resolveMode(event.target));
    }
    function leave() {
      tracking = false;
      setInside(false);
      setPressed(false);
    }
    function down(event: PointerEvent) {
      if (event.pointerType === "mouse") setPressed(true);
    }
    function up() {
      setPressed(false);
    }

    window.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerover", over, { passive: true });
    root.addEventListener("pointerleave", leave);
    window.addEventListener("blur", leave);
    window.addEventListener("pointerdown", down, { passive: true });
    window.addEventListener("pointerup", up, { passive: true });
    return () => {
      window.removeEventListener("pointermove", move);
      document.removeEventListener("pointerover", over);
      root.removeEventListener("pointerleave", leave);
      window.removeEventListener("blur", leave);
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", up);
    };
  }, [fine, x, y, dotX, dotY, viewX, viewY]);

  // The native cursor is hidden only while ours is actually drawn: never a pointer-less moment
  // (text fields, the top-layer mobile menu, before the first move).
  const drawn = fine && inside && !menuShown && mode !== "hidden";
  useEffect(() => {
    if (!drawn) return;
    const root = document.documentElement;
    root.classList.add("has-cursor");
    return () => root.classList.remove("has-cursor");
  }, [drawn]);

  if (!fine) return null;
  const shape = drawn ? mode : "none";
  const press = cn("transition-[scale] duration-300 ease-out motion-reduce:transition-none", pressed && "scale-[0.82]");

  return (
    <>
      {/* The blend mode must sit on the fixed layer itself: it blends with its parent stacking context. */}
      <motion.div
        aria-hidden
        data-qa-hide
        data-cursor-root=""
        className="pointer-events-none fixed top-0 left-0 z-(--z-cursor) mix-blend-difference will-change-transform"
        style={{ x: reduce ? x : dotX, y: reduce ? y : dotY }}
      >
        <div className={press}>
          <span
            className={cn(
              SHAPE,
              "size-2.5 bg-white duration-300",
              shape === "default" ? "scale-100 opacity-100" : "scale-0 opacity-0",
            )}
          />
          <span
            className={cn(
              SHAPE,
              "size-11 border border-white duration-300",
              shape === "link" ? "scale-100 opacity-100" : "scale-[0.23] opacity-0",
            )}
          />
        </div>
      </motion.div>

      {/* Solid accent disc: a separate layer, so it never inherits the difference blend. */}
      <motion.div
        aria-hidden
        data-qa-hide
        data-cursor-root=""
        className="pointer-events-none fixed top-0 left-0 z-(--z-cursor) will-change-transform"
        style={{ x: reduce ? x : viewX, y: reduce ? y : viewY }}
      >
        <div className={press}>
          <span
            className={cn(
              SHAPE,
              // Hairline + soft lift keep the disc legible even over accent-filled surfaces.
              "eyebrow grid size-[5.75rem] place-items-center bg-accent text-on-accent shadow-[0_0_0_1px_rgb(0_0_0/0.14),0_12px_32px_-12px_rgb(0_0_0/0.5)] duration-500",
              shape === "view" ? "scale-100 opacity-100" : "scale-[0.3] opacity-0",
            )}
          >
            View
          </span>
        </div>
      </motion.div>
    </>
  );
}
