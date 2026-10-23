"use client";

import { useMemo, useRef } from "react";
import { EASE, gsap, useGSAP } from "@/lib/gsap";
import { laneD, layoutCategories, SCRIPTS, streamFrame, type CategoriesLayout, type StreamFrame } from "./categories-layout";
import { MicroLabel, playWithMotion, r1, useFrameSize, VisualFrame, type Playback, type Variant } from "./shared";

const INTRO_END = 1.6;
const fixed = (value: number) => value.toFixed(3);

/**
 * Multilingual URL categorization: tokens in six scripts flow into one shared embedding, then
 * land in one of 60 categories; each cell glows and slowly fades, so the grid keeps a calm,
 * always-changing memory of recent decisions.
 */
export function CategoriesVisual({ variant, className }: { variant: Variant; className?: string }) {
  const root = useRef<HTMLDivElement>(null);
  const played = useRef(false);
  const size = useFrameSize(root);
  const layout = useMemo(() => (size ? layoutCategories(size, variant) : null), [size, variant]);
  const still = useMemo(() => (layout ? streamFrame(layout, 0) : null), [layout]);

  useGSAP(
    (context) => {
      const el = root.current;
      if (!el || !layout) return;
      return playWithMotion(context, el, () => categoriesTimeline(el, layout), played);
    },
    { scope: root, dependencies: [layout], revertOnUpdate: true },
  );

  return (
    <VisualFrame ref={root} size={size} variant={variant} className={className}>
      {layout && still ? <CategoriesSvg layout={layout} still={still} /> : null}
    </VisualFrame>
  );
}

function categoriesTimeline(el: HTMLElement, layout: CategoriesLayout): Playback {
  const q = gsap.utils.selector(el);
  const cells = q<SVGRectElement>("[data-cell]");
  const pills = q<SVGGElement>("[data-pill]");
  const dots = q<SVGCircleElement>("[data-dot]");
  const streaks = q<SVGPathElement>("[data-streak]");
  const ring = q<SVGCircleElement>("[data-focus-ring]")[0];
  const shown = cells.map(() => -1);
  let shownPulse = -1;

  // The markup is frame 0; every tick renders the stream at the clock's time.
  const render = (t: number) => {
    const frame = streamFrame(layout, t);
    frame.pills.forEach((p, j) => {
      pills[j].style.opacity = fixed(p.opacity);
      if (p.opacity > 0) pills[j].setAttribute("transform", `translate(${r1(p.x)} ${r1(p.y)}) scale(${fixed(p.scale)})`);
    });
    frame.dots.forEach((d, j) => {
      dots[j].style.opacity = streaks[j].style.opacity = fixed(d.opacity);
      if (d.opacity <= 0) return;
      dots[j].setAttribute("cx", `${r1(d.x)}`);
      dots[j].setAttribute("cy", `${r1(d.y)}`);
      streaks[j].setAttribute("d", d.streak);
    });
    frame.glow.forEach((g, i) => {
      if (Math.abs(g - shown[i]) < 0.004) return;
      shown[i] = g;
      cells[i].setAttribute("fill-opacity", fixed(g));
    });
    if (Math.abs(frame.pulse - shownPulse) > 0.004) {
      shownPulse = frame.pulse;
      ring.setAttribute("transform", `scale(${fixed(1 + frame.pulse * 0.4)})`);
      ring.style.opacity = fixed(0.55 + frame.pulse * 0.45);
    }
  };

  /* ---------- Intro: the grid, the embedding and the labels are at rest from the first frame; the
     lanes draw in and the stream fades up already moving. ---------- */
  const tl = gsap.timeline();
  tl.fromTo("[data-lane]", { drawSVG: "0%" }, { drawSVG: "100%", duration: 1.1, ease: EASE.inOut, stagger: 0.06 }, 0)
    .from("[data-stream]", { opacity: 0, duration: 0.8, ease: "none" }, 0.7);

  /* ---------- Loop: one clock drives the whole stream; it repeats exactly after `cycle`. ---------- */
  const clock = { t: 0 };
  const { cycle } = layout.stream;
  tl.to(clock, { t: cycle, duration: cycle, ease: "none", repeat: -1, onUpdate: () => render(clock.t) }, INTRO_END - 0.5);

  return {
    timeline: tl,
    introEnd: INTRO_END,
    // Back to the markup: frame-0 positions and glow, opacities from the markup's attributes, a resting ring.
    reset: () => {
      render(0);
      for (const el of [...pills, ...dots, ...streaks, ring]) el.style.removeProperty("opacity");
      ring.removeAttribute("transform");
    },
  };
}

function CategoriesSvg({ layout, still }: { layout: CategoriesLayout; still: StreamFrame }) {
  const { font, cells, cellSize, lanes, focus, pill, labels, scripts } = layout;
  const radius = Math.min(3, cellSize * 0.2);
  return (
    <>
      <g stroke="currentColor" strokeOpacity={0.5}>
        {lanes.map((lane, i) => (
          <path key={i} data-lane d={laneD(lane)} />
        ))}
      </g>

      {/* Outline in the structure colour, glow as the accent fill. */}
      <g stroke="currentColor" strokeOpacity={0.4} className="fill-accent-ink">
        {cells.map((c, i) => (
          <rect
            key={i}
            data-cell
            x={r1(c.x)}
            y={r1(c.y)}
            width={r1(cellSize)}
            height={r1(cellSize)}
            rx={r1(radius)}
            fillOpacity={fixed(still.glow[i])}
          />
        ))}
      </g>

      <g transform={`translate(${r1(focus[0])} ${r1(focus[1])})`}>
        <g data-focus className="text-fg-muted">
          <circle data-focus-ring r={8.5} stroke="currentColor" opacity={0.55} />
          <circle r={3} fill="currentColor" />
        </g>
      </g>

      <g data-stream>
        {scripts.map((script, j) => {
          const p = still.pills[j];
          const d = still.dots[j];
          return (
            <g key={j}>
              <g
                data-pill
                opacity={fixed(p.opacity)}
                transform={`translate(${r1(p.x)} ${r1(p.y)}) scale(${fixed(p.scale)})`}
              >
                <rect
                  x={-pill.w / 2}
                  y={-pill.h / 2}
                  width={pill.w}
                  height={pill.h}
                  rx={pill.h / 2}
                  stroke="currentColor"
                  className="fill-bg-sunken text-fg-subtle"
                />
                <text textAnchor="middle" dominantBaseline="central" fontSize={font} className="fill-fg-muted font-mono">
                  {SCRIPTS[script]}
                </text>
              </g>
              <path data-streak d={d.streak} opacity={fixed(d.opacity)} stroke="currentColor" strokeLinecap="round" className="text-fg-muted" />
              <circle data-dot r={2.4} cx={r1(d.x)} cy={r1(d.y)} opacity={fixed(d.opacity)} className="fill-accent-ink" />
            </g>
          );
        })}
      </g>

      {labels.map((label) => (
        <MicroLabel key={label.text} data-label size={font} x={r1(label.x)} y={r1(label.y)} textAnchor={label.anchor}>
          {label.text}
        </MicroLabel>
      ))}
    </>
  );
}
