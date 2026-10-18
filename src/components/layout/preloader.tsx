"use client";

import { useLenis } from "lenis/react";
import { useEffect, useRef, useState } from "react";
import { site } from "@/content/site";
import { useGSAP } from "@/lib/gsap";
import { markReady, signalIntroReveal } from "@/lib/intro";
import { STORAGE_KEYS } from "@/lib/preferences";

const FONT_WAIT_MS = 2500;
/** Longest wait for the page underneath to hydrate and arm its entrance ([data-intro-armed]). */
const ARM_WAIT_MS = 3000;
/** The curtain never lifts earlier than this (ms since navigation): the wordmark gets to rise. */
const MIN_INTRO_MS = 800;
/** Once everything is ready the count completes by this mark (ms since navigation)… */
const COUNT_BY_MS = 1300;
/** …with a visible final run of at least this long. */
const MIN_FINISH_MS = 350;
/** While the page is still loading, the count eases towards this share and holds. */
const HOLD = 0.9;
const HOLD_MS = 1200;
/** Exit choreography (ms from the exit's start). The page is revealed as the first curtain moves. */
const PAGE_CURTAIN_AT = 450;
const ACCENT_CURTAIN_AT = 580;
const CURTAIN_MS = 1000;

// WAAPI takes timing functions as strings; these mirror the --ease-* tokens.
const EASE_IN = "cubic-bezier(0.7, 0, 0.84, 0)";
const EASE_IN_OUT = "cubic-bezier(0.76, 0, 0.24, 1)";
/**
 * ≈ easeInOutQuad (slope 4t, then 4(1 − t)): a slow start, so a hydration stall early on costs the
 * digits little, then a soft arrival at the hold.
 */
const HOLD_EASE = "cubic-bezier(0.45, 0, 0.55, 1)";
const holdSlope = (t: number) => (t < 0.5 ? 4 * t : 4 * (1 - t));

// The wordmark lines rise from first paint (CSS @starting-style, so hydration can't stall them)
// and leave on [data-exit]. Tailwind needs literal class names, hence one string per line.
const LINE = "block transition-[translate] duration-900 ease-out starting:translate-y-[110%]";
const LINE_EXIT = "group-data-exit/pl:-translate-y-[110%] group-data-exit/pl:duration-600 group-data-exit/pl:ease-in";
const LINE_DELAYS = [
  "delay-[50ms] group-data-exit/pl:delay-0",
  "delay-[120ms] group-data-exit/pl:delay-[30ms]",
  "delay-[190ms] group-data-exit/pl:delay-[60ms]",
  "delay-[260ms] group-data-exit/pl:delay-[90ms]",
] as const;
const lineClass = (i: number, extra = "") => `${LINE} ${LINE_EXIT} ${LINE_DELAYS[i]} ${extra}`;

const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, Math.max(0, ms)));
const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
const curtain = [{ transform: "translateY(0)" }, { transform: "translateY(-100%)" }];

/**
 * First-visit intro: a 000→100 counter while fonts load and the page hydrates, then a two-layer
 * curtain (page colour, then accent) lifts off the hero. It leaves as soon as the page is ready
 * (never before MIN_INTRO_MS); the bar and curtains run on the compositor (WAAPI), so they stay
 * smooth through hydration, and the counter reads the bar. Once per session; skipped entirely
 * under reduced motion (the head script sets data-intro="skip" before paint; CSS hides this).
 * Contract: a page whose entrance waits for the reveal (the hero) sets data-intro-armed once its
 * motion is set up; the curtain waits for it, so it never lifts onto unhydrated markup.
 */
export function Preloader() {
  const root = useRef<HTMLDivElement>(null);
  const lenis = useLenis();
  const [done, setDone] = useState(false);

  // Hold the page still while the intro plays.
  useEffect(() => {
    if (!lenis || done || document.documentElement.dataset.intro === "skip") return;
    lenis.stop();
    return () => lenis.start();
  }, [lenis, done]);

  useGSAP(
    () => {
      const el = root.current;
      const html = document.documentElement;
      if (!el) return;
      // Skipped, or already played this page load (dev remounts).
      if (html.dataset.intro === "skip" || html.dataset.introRevealed === "true") {
        signalIntroReveal();
        markReady();
        return;
      }
      const counter = el.querySelector<HTMLElement>("[data-counter]");
      const bar = el.querySelector<HTMLElement>("[data-pl-bar]");
      const pageCurtain = el.querySelector<HTMLElement>("[data-curtain='page']");
      const accentCurtain = el.querySelector<HTMLElement>("[data-curtain='accent']");
      if (!counter || !bar || !pageCurtain || !accentCurtain) return;

      let cancelled = false;
      let frame = 0;
      let revealTimer = 0;
      let armObserver: MutationObserver | undefined;
      const animations: Animation[] = [];
      const run = (target: HTMLElement, keyframes: Keyframe[], timing: KeyframeAnimationOptions) => {
        const animation = target.animate(keyframes, { fill: "both", ...timing });
        animations.push(animation);
        return animation;
      };

      // Nothing under the curtain can take focus until it lifts. On <body>, which has hydrated by
      // now: the page segments may not have, and an attribute on them would be a hydration mismatch.
      document.body.inert = true;
      const release = () => {
        document.body.inert = false;
      };

      // The count: the bar's scale, sampled every frame for the digits.
      const hold = run(bar, [{ scale: "0 1" }, { scale: `${HOLD} 1` }], { duration: HOLD_MS, easing: HOLD_EASE });
      let count = { animation: hold, from: 0, to: HOLD };
      const progress = () => count.from + (count.to - count.from) * (count.animation.effect?.getComputedTiming().progress ?? 0);
      let shown = "000";
      const draw = () => {
        const text = String(Math.round(progress() * 100)).padStart(3, "0");
        if (text !== shown) counter.textContent = shown = text;
        frame = requestAnimationFrame(draw);
      };
      frame = requestAnimationFrame(draw);

      const exit = () => {
        if (cancelled) return;
        cancelAnimationFrame(frame);
        counter.textContent = "100";
        el.dataset.exit = ""; // CSS: the wordmark and counter leave, 30ms apart
        bar.style.transformOrigin = "right center";
        run(bar, [{ scale: "1 1" }, { scale: "0 1" }], { duration: 500, easing: EASE_IN });
        run(pageCurtain, curtain, { duration: CURTAIN_MS, delay: PAGE_CURTAIN_AT, easing: EASE_IN_OUT });
        const last = run(accentCurtain, curtain, { duration: CURTAIN_MS, delay: ACCENT_CURTAIN_AT, easing: EASE_IN_OUT });
        revealTimer = window.setTimeout(() => {
          release();
          signalIntroReveal();
        }, PAGE_CURTAIN_AT);
        last.finished.then(() => {
          try {
            sessionStorage.setItem(STORAGE_KEYS.intro, "1");
          } catch {}
          el.style.display = "none";
          markReady();
          setDone(true);
        }, () => {});
      };

      const armed = new Promise<void>((resolve) => {
        const check = () => {
          if (!document.querySelector("[data-intro-armed]")) return;
          armObserver?.disconnect();
          resolve();
        };
        armObserver = new MutationObserver(check);
        armObserver.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["data-intro-armed"] });
        check();
      });

      // Hand-over: the count finishes from wherever it is, within the COUNT_BY_MS budget, picking up
      // at the speed it is already moving (no stall or kick).
      const finishCount = () => {
        armObserver?.disconnect(); // also when the wait timed out
        if (cancelled) return;
        const from = progress();
        const duration = Math.max(MIN_FINISH_MS, COUNT_BY_MS - performance.now());
        const t = Math.min(1, Number(hold.currentTime ?? 0) / HOLD_MS);
        const slope = (((holdSlope(t) * HOLD) / HOLD_MS) * duration) / Math.max(0.01, 1 - from);
        const finish = run(bar, [{ scale: `${from} 1` }, { scale: "1 1" }], {
          duration,
          easing: `cubic-bezier(0.25, ${Math.min(1, slope * 0.25).toFixed(3)}, 0.35, 1)`,
        });
        hold.cancel();
        count = { animation: finish, from, to: 1 };
        finish.finished.then(exit, () => {});
      };

      // Ready = fonts in (or given up on), the page hydrated and armed, minimum time served; then a
      // frame for its effects to settle.
      Promise.all([
        Promise.race([document.fonts.ready, wait(FONT_WAIT_MS)]),
        Promise.race([armed, wait(ARM_WAIT_MS)]),
        wait(MIN_INTRO_MS - performance.now()),
      ])
        .then(nextFrame)
        .then(finishCount);

      return () => {
        cancelled = true;
        armObserver?.disconnect();
        cancelAnimationFrame(frame);
        window.clearTimeout(revealTimer);
        animations.forEach((animation) => animation.cancel());
        release();
        delete el.dataset.exit;
        bar.style.removeProperty("transform-origin");
      };
    },
    { scope: root },
  );

  return (
    <div ref={root} className="preloader group/pl fixed inset-0 z-(--z-preloader)" aria-hidden="true">
      <div data-curtain="accent" className="absolute inset-0 bg-accent" />
      <div
        data-curtain="page"
        className="absolute inset-0 flex flex-col justify-between bg-bg px-(--gutter) pt-6 pb-8 text-fg"
      >
        <div className="eyebrow flex justify-between text-fg-muted">
          <span className="overflow-hidden">
            <span data-pl-text className={lineClass(0)}>
              {site.name}
            </span>
          </span>
          <span className="overflow-hidden">
            <span data-pl-text className={lineClass(1)}>
              {site.role} — {site.company}
            </span>
          </span>
        </div>

        <div className="flex items-end justify-between gap-6">
          <p className="font-serif text-headline">
            <span className="block overflow-hidden pb-[0.08em]">
              <span data-pl-text className={lineClass(2)}>
                Signal
              </span>
            </span>
            <span className="block overflow-hidden pb-[0.08em]">
              <span data-pl-text className={lineClass(3, "italic text-fg-muted")}>
                from noise.
              </span>
            </span>
          </p>
          <span className="overflow-hidden font-mono text-[clamp(3.5rem,2rem+8vw,9rem)] leading-none tracking-tight">
            <span
              data-counter
              className={`block transition-[translate] ${LINE_EXIT} group-data-exit/pl:delay-[120ms]`}
            >
              000
            </span>
          </span>
        </div>

        <div className="absolute inset-x-0 bottom-0 h-px bg-line">
          <div data-pl-bar className="h-full origin-left scale-x-0 bg-accent" />
        </div>
      </div>
    </div>
  );
}
