import { useEffect, useState, type ReactNode, type Ref, type RefObject, type SVGProps } from "react";
import { cn } from "@/lib/cn";
import { gsap } from "@/lib/gsap";
import { onIntroReveal } from "@/lib/intro";

export type Variant = "card" | "hero";
export type Size = { width: number; height: number };
export type Pt = readonly [number, number];

/* ------------------------------------------------------------------------------------------
   Deterministic randomness — layouts must be identical on every render (no Math.random).
   ------------------------------------------------------------------------------------------ */

/** mulberry32: tiny seeded PRNG returning floats in [0, 1). */
export function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal sample (Box-Muller) from a seeded source. */
export function gaussian(rand: () => number) {
  const u = Math.max(rand(), 1e-9);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}

/** Seeded Fisher-Yates shuffle (returns a new array). */
export function shuffle<T>(items: readonly T[], rand: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Start delays spread evenly over `amount` seconds in a seeded random order (GSAP's `from: "random"` stagger). */
export function randomStagger(count: number, amount: number, seed: number): number[] {
  const delays = new Array<number>(count).fill(0);
  shuffle(
    Array.from({ length: count }, (_, i) => i),
    seeded(seed),
  ).forEach((index, rank) => {
    delays[index] = count > 1 ? (amount * rank) / (count - 1) : 0;
  });
  return delays;
}

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Rounds to 0.1px: keeps path strings short without visible error. */
export const r1 = (value: number) => Math.round(value * 10) / 10;

/* ------------------------------------------------------------------------------------------
   Geometry
   ------------------------------------------------------------------------------------------ */

export function cubicD(p0: Pt, p1: Pt, p2: Pt, p3: Pt, move = true) {
  return `${move ? `M${r1(p0[0])} ${r1(p0[1])}` : ""}C${r1(p1[0])} ${r1(p1[1])} ${r1(p2[0])} ${r1(p2[1])} ${r1(p3[0])} ${r1(p3[1])}`;
}

export function cubicAt(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return [a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]];
}

/** Smooth closed curve through `points` (uniform Catmull-Rom converted to cubic Béziers). */
export function closedCurveD(points: readonly Pt[]) {
  const n = points.length;
  let d = `M${r1(points[0][0])} ${r1(points[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += cubicD(p1, c1, c2, p2, false);
  }
  return `${d}Z`;
}

/** A polyline with cumulative lengths, for constant-speed motion along it. */
export type Route = { points: readonly Pt[]; cumulative: readonly number[]; length: number };

export function makeRoute(points: readonly Pt[]): Route {
  const cumulative = [0];
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1];
    const [bx, by] = points[i];
    cumulative.push(cumulative[i - 1] + Math.hypot(bx - ax, by - ay));
  }
  return { points, cumulative, length: cumulative[cumulative.length - 1] };
}

export function pointOnRoute(route: Route, distance: number): Pt {
  const { points, cumulative } = route;
  const d = clamp(distance, 0, route.length);
  let i = 1;
  while (i < cumulative.length - 1 && cumulative[i] < d) i++;
  const span = cumulative[i] - cumulative[i - 1] || 1;
  const t = (d - cumulative[i - 1]) / span;
  return [points[i - 1][0] + (points[i][0] - points[i - 1][0]) * t, points[i - 1][1] + (points[i][1] - points[i - 1][1]) * t];
}

export const routeD = (route: Route) =>
  route.points.map(([x, y], i) => `${i ? "L" : "M"}${r1(x)} ${r1(y)}`).join("");

/** A rendered path, sampled once: `at(distance)` is plain arithmetic, so per-frame motion never reads layout. */
export type PathTable = { length: number; at: (distance: number) => Pt };

/**
 * Samples `path` every ~`step` px using the browser's own geometry (it matches the path's dash
 * lengths exactly). Sample before writing anything in the same task: getPointAtLength after a
 * style write forces a style and layout flush — once per call.
 */
export function samplePath(path: SVGGeometryElement, step = 1.5): PathTable {
  const length = path.getTotalLength();
  const n = Math.max(1, Math.ceil(length / step));
  const xy = new Float32Array((n + 1) * 2);
  for (let i = 0; i <= n; i++) {
    const p = path.getPointAtLength((i / n) * length);
    xy[i * 2] = p.x;
    xy[i * 2 + 1] = p.y;
  }
  return {
    length,
    at(distance) {
      const f = length > 0 ? (clamp(distance, 0, length) / length) * n : 0;
      const i = Math.min(n - 1, Math.floor(f));
      const t = f - i;
      return [xy[i * 2] + (xy[i * 2 + 2] - xy[i * 2]) * t, xy[i * 2 + 1] + (xy[i * 2 + 3] - xy[i * 2 + 1]) * t];
    },
  };
}

/* ------------------------------------------------------------------------------------------
   Type
   ------------------------------------------------------------------------------------------ */

/** Micro-label size in px (the eyebrow size): the frame is drawn 1:1 in CSS px, so this is the rendered size. */
export const LABEL_SIZE = 12;

/** Base stroke weight per variant; accent strokes sit half a pixel heavier. */
export const STROKE: Record<Variant, { base: number; accent: number }> = {
  card: { base: 1.5, accent: 2 },
  hero: { base: 1, accent: 1.5 },
};

/** Geist Mono advance (0.6em) + the 0.08em tracking of the eyebrow style. */
export const textWidth = (text: string, size: number) => text.length * size * 0.68;

export function MicroLabel({
  tone = "muted",
  size,
  className,
  children,
  ...rest
}: SVGProps<SVGTextElement> & { tone?: "muted" | "subtle"; size: number; children: ReactNode }) {
  return (
    <text
      fontSize={size}
      letterSpacing="0.08em"
      className={cn("font-mono", tone === "muted" ? "fill-fg-muted" : "fill-fg-subtle", className)}
      {...rest}
    >
      {children}
    </text>
  );
}

export type Box = { x: number; y: number; width: number; height: number };

/** Faint dot lattice: the plotting area a figure sits on, centred in `box` so its margins match. */
export function Lattice({ id, box, step, opacity = 0.7 }: { id: string; box: Box; step: number; opacity?: number }) {
  const { x, y, width, height } = box;
  return (
    <>
      <defs>
        <pattern
          id={id}
          width={step}
          height={step}
          x={r1(x + ((width % step) - step) / 2)}
          y={r1(y + ((height % step) - step) / 2)}
          patternUnits="userSpaceOnUse"
        >
          <circle cx={step / 2} cy={step / 2} r={1} fill="currentColor" />
        </pattern>
      </defs>
      <rect data-lattice x={r1(x)} y={r1(y)} width={r1(width)} height={r1(height)} fill={`url(#${id})`} opacity={opacity} />
    </>
  );
}

/* ------------------------------------------------------------------------------------------
   Frame + playback
   ------------------------------------------------------------------------------------------ */

/** Container size in CSS px; null until measured (server render and the first client frame). */
export function useFrameSize(ref: RefObject<HTMLElement | null>) {
  const [size, setSize] = useState<Size | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let measured = false;
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.round(entry.contentRect.width);
      const height = Math.round(entry.contentRect.height);
      if (!width || !height) return;
      const commit = () => setSize((prev) => (prev?.width === width && prev.height === height ? prev : { width, height }));
      clearTimeout(timer);
      // First measurement lands immediately; live resizes settle first (each re-layout rebuilds the SVG).
      if (measured) timer = setTimeout(commit, 180);
      else {
        measured = true;
        commit();
      }
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [ref]);

  return size;
}

/** Root of every visual: fills its container, decorative, and hosts a 1:1 px SVG once measured. */
export function VisualFrame({
  ref,
  size,
  variant,
  className,
  children,
}: {
  ref: Ref<HTMLDivElement>;
  size: Size | null;
  variant: Variant;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div ref={ref} aria-hidden className={cn("pointer-events-none relative size-full select-none", className)}>
      {size ? (
        <svg
          // Remount on resize so GSAP never reverts transforms onto a re-laid-out tree.
          key={`${size.width}x${size.height}`}
          width={size.width}
          height={size.height}
          viewBox={`0 0 ${size.width} ${size.height}`}
          preserveAspectRatio="xMidYMid meet"
          fill="none"
          strokeWidth={STROKE[variant].base}
          className="absolute inset-0 size-full text-fg-subtle"
        >
          {children}
        </svg>
      ) : null}
    </div>
  );
}

/**
 * A visual's master timeline (one-off intro, then an endless loop) and where the intro ends.
 * `reset` restores whatever the timeline wrote outside GSAP (direct attribute writes), so a
 * reverted visual shows its settled markup again.
 */
export type Playback = { timeline: gsap.core.Timeline; introEnd: number; reset?: () => void };

/** A frame builds its timeline once it is within this share of a screen of the viewport. */
const NEAR = 0.5;

function isNear(el: Element) {
  const r = el.getBoundingClientRect();
  const mx = window.innerWidth * NEAR;
  const my = window.innerHeight * NEAR;
  return r.width > 0 && r.bottom > -my && r.top < window.innerHeight + my && r.right > -mx && r.left < window.innerWidth + mx;
}

/**
 * Runs a visual's master timeline only while its frame can be seen, and never before the
 * preloader lifts. The timeline is built lazily (`build` runs inside `context`, so it reverts
 * with it) once the frame comes within half a screen of the viewport: offscreen visuals cost
 * nothing at hydration or when a route is re-shown. Visibility comes from IntersectionObserver,
 * so it also works inside pinned or horizontal scrollers: the intro starts once 20% of the frame
 * is visible and the loop pauses when the frame is fully off screen — or when another deck card
 * has landed on it (project-deck.tsx sets `data-covered` on the card). After a rebuild (resize,
 * route re-shown) the intro is skipped. Visuals reach it through playWithMotion.
 */
export function bindPlayback(
  trigger: Element,
  context: gsap.Context,
  build: () => Playback,
  played: { current: boolean },
) {
  let playback: Playback | null = null;
  let near = isNear(trigger);
  let started = played.current;
  let visible = false;
  let revealed = false;
  const card = trigger.closest("[data-card]");
  let covered = card?.hasAttribute("data-covered") ?? false;
  let frame = 0;

  const nearObserver = new IntersectionObserver(
    (entries) => {
      near = entries[entries.length - 1].isIntersecting;
      sync();
    },
    { rootMargin: `${NEAR * 100}%` },
  );
  const seenObserver = new IntersectionObserver(
    (entries) => {
      const entry = entries[entries.length - 1];
      visible = entry.isIntersecting && entry.intersectionRatio > 0;
      if (entry.intersectionRatio >= 0.2) started = true;
      sync();
    },
    { threshold: [0, 0.2] },
  );
  const coverObserver = new MutationObserver(() => {
    covered = card?.hasAttribute("data-covered") ?? false;
    sync();
  });

  function sync() {
    if (!playback && near && !covered) {
      cancelAnimationFrame(frame);
      nearObserver.disconnect();
      playback = context.add(build);
      const { timeline, introEnd } = playback;
      timeline.pause();
      // With events, so visuals that render in onUpdate draw the loop's state, not the intro's first frame.
      if (played.current) timeline.seek(introEnd, false);
      else timeline.call(() => void (played.current = true), undefined, introEnd);
    }
    if (!playback) return;
    if (started && visible && revealed && !covered) playback.timeline.play();
    else playback.timeline.pause();
  }

  if (card) coverObserver.observe(card, { attributes: true, attributeFilter: ["data-covered"] });
  if (!near) {
    nearObserver.observe(trigger);
    // Observers report after the next paint; a jump in this task (a route change landing on
    // #work) is caught right before it instead, so the settled markup never flashes first.
    frame = requestAnimationFrame(() => {
      near ||= isNear(trigger);
      sync();
    });
  }
  seenObserver.observe(trigger);
  const stopReveal = onIntroReveal(() => {
    revealed = true;
    sync();
  });
  sync();

  return () => {
    cancelAnimationFrame(frame);
    nearObserver.disconnect();
    seenObserver.disconnect();
    coverObserver.disconnect();
    stopReveal();
    playback?.reset?.();
  };
}

/**
 * A visual's playback (bindPlayback) whenever motion is allowed: call it inside useGSAP and return
 * the result. The matchMedia lives outside useGSAP's context on purpose. Nested in it, a route
 * hidden by React Activity (cacheComponents) reverts the handler's context twice, and GSAP's
 * second pass re-applies the start values of fromTo tweens (opacity 0 on lit states), leaving the
 * settled frame broken until the visual remounts. Selectors inside stay scoped to `trigger`.
 */
export function playWithMotion(
  context: gsap.Context,
  trigger: HTMLElement,
  build: () => Playback,
  played: { current: boolean },
) {
  let mm: gsap.MatchMedia | undefined;
  context.ignore(() => {
    mm = gsap.matchMedia(trigger);
    mm.add("(prefers-reduced-motion: no-preference)", (handler) => bindPlayback(trigger, handler, build, played));
  });
  return () => mm?.revert();
}
