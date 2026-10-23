"use client";

import { useId, useMemo, useRef } from "react";
import { EASE, gsap, useGSAP } from "@/lib/gsap";
import { layoutClusters, type ClusterDot, type ClustersLayout } from "./clusters-layout";
import {
  clamp,
  MicroLabel,
  playWithMotion,
  r1,
  randomStagger,
  samplePath,
  STROKE,
  useFrameSize,
  VisualFrame,
  type Playback,
  type Variant,
} from "./shared";

const INTRO_END = 3.7;
/** Intro timing (s) for the points: every class point starts where it was scattered, among the
 *  noise, and glides home. Starts are staggered in a seeded random order. */
const DOT_GLIDE = { at: 0.3, spread: 0.55, duration: 2 };

type Point = {
  el: SVGCircleElement;
  glideAt: number;
  dx: number;
  dy: number;
  /** Eased progress last written to the DOM (1 = the markup's settled state). */
  shownGlide: number;
};

/**
 * EDR threat detection: telemetry becomes behavioural embeddings that resolve from noise into
 * classes; a decision boundary draws around the one class the model separates out.
 */
export function ClustersVisual({ variant, className }: { variant: Variant; className?: string }) {
  const root = useRef<HTMLDivElement>(null);
  const played = useRef(false);
  const size = useFrameSize(root);
  const layout = useMemo(() => (size ? layoutClusters(size, variant) : null), [size, variant]);
  const gridId = `clusters-grid-${useId().replace(/[^\w-]/g, "")}`;

  useGSAP(
    (context) => {
      const el = root.current;
      if (!el || !layout) return;
      return playWithMotion(context, el, () => clustersTimeline(el, layout), played);
    },
    { scope: root, dependencies: [layout], revertOnUpdate: true },
  );

  return (
    <VisualFrame ref={root} size={size} variant={variant} className={className}>
      {layout ? <ClustersSvg layout={layout} gridId={gridId} /> : null}
    </VisualFrame>
  );
}

function clustersTimeline(el: HTMLElement, layout: ClustersLayout): Playback {
  const q = gsap.utils.selector(el);
  const boundary = q<SVGPathElement>("[data-boundary]")[0];
  const pen = q<SVGCircleElement>("[data-pen]")[0];
  const groups = q<SVGGElement>("[data-cluster]");
  const noise = q<SVGCircleElement>("[data-noise] circle");
  const dots = q<SVGCircleElement>("[data-dot]");
  // The only geometry read, before anything is written.
  const edge = samplePath(boundary);
  const tip = { at: 0 };
  const movePen = () => {
    const [x, y] = edge.at(tip.at);
    pen.setAttribute("cx", r1(x).toString());
    pen.setAttribute("cy", r1(y).toString());
  };

  // Hundreds of points: one clock renders their glides with plain attribute writes, so there are
  // no per-point tweens to set up and no per-point style reads. The points are visible throughout
  // (the first frame is the scatter, not an empty plot); only the class points move.
  const glideAt = randomStagger(dots.length, DOT_GLIDE.spread, 7);
  const points: Point[] = dots.map((dot, i) => ({
    el: dot,
    glideAt: DOT_GLIDE.at + glideAt[i],
    dx: Number(dot.dataset.dx ?? 0),
    dy: Number(dot.dataset.dy ?? 0),
    shownGlide: 1,
  }));
  const clock = { t: 0 };
  // Eased 0→1 progress of a phase; exactly 1 once it is over, so settled points get their markup back.
  const phase = (ease: (p: number) => number, start: number, duration: number) => {
    const p = clamp((clock.t - start) / duration, 0, 1);
    return p < 1 ? ease(p) : 1;
  };
  const renderPoints = () => {
    for (const p of points) {
      const glide = phase(EASE.inOut, p.glideAt, DOT_GLIDE.duration);
      if (glide !== p.shownGlide) {
        p.shownGlide = glide;
        if (glide >= 1) p.el.removeAttribute("transform");
        else p.el.setAttribute("transform", `translate(${r1(p.dx * (1 - glide))} ${r1(p.dy * (1 - glide))})`);
      }
    }
  };
  const pointsEnd = DOT_GLIDE.at + DOT_GLIDE.spread + DOT_GLIDE.duration;
  renderPoints(); // the intro's first frame, before it plays

  const tl = gsap.timeline({ defaults: { ease: EASE.out } });
  tl.to(clock, { t: pointsEnd, duration: pointsEnd, ease: "none", onUpdate: renderPoints }, 0)
    .fromTo(boundary, { drawSVG: "0%" }, { drawSVG: "100%", duration: 1.5, ease: EASE.inOut }, 2.05)
    .fromTo(pen, { opacity: 0 }, { opacity: 1, duration: 0.2, ease: "none", immediateRender: false }, 2.05)
    .fromTo(tip, { at: 0 }, { at: edge.length, duration: 1.5, ease: EASE.inOut, onUpdate: movePen }, 2.05)
    .to(pen, { opacity: 0, duration: 0.5, ease: "none" }, 3.45)
    .from("[data-margin]", { opacity: 0, duration: 1, ease: "none" }, 3);
  if (layout.caption.text) {
    // The caption names the boundary, so it arrives with it (the plot's own label is at rest).
    tl.fromTo("[data-leader]", { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.5, ease: EASE.inOut }, 3.05).from(
      "[data-label='caption']",
      { opacity: 0, duration: 0.7 },
      3.3,
    );
  }

  // Loop: every class breathes on its own slow cycle (the separated class without drifting, so
  // its boundary stays on the caption's leader); a few noise points flicker.
  groups.forEach((group, i) => {
    const accent = group.hasAttribute("data-accent");
    tl.to(
      group,
      {
        scale: accent ? 1.02 : 1.045,
        x: accent ? 0 : ((i * 7) % 5) - 2,
        y: accent ? 0 : ((i * 3) % 5) - 2,
        svgOrigin: group.dataset.origin,
        duration: 3.2 + ((i * 0.53) % 1.6),
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
      },
      INTRO_END - 0.3,
    );
  });
  // The margin keeps a slow watch around the class.
  tl.to("[data-margin]", { strokeDashoffset: -60, duration: 14, ease: "none", repeat: -1 }, INTRO_END);
  tl.to(
    noise.filter((_, i) => i % 3 === 0),
    { opacity: 0.08, duration: 1.8, ease: "sine.inOut", stagger: { each: 0.9, repeat: -1, yoyo: true } },
    INTRO_END,
  );

  return {
    timeline: tl,
    introEnd: INTRO_END,
    reset: () => {
      for (const p of points) p.el.removeAttribute("transform");
    },
  };
}

function Dot({ dot, ...rest }: { dot: ClusterDot } & Record<`data-${string}`, string | boolean>) {
  return <circle cx={r1(dot.x)} cy={r1(dot.y)} r={r1(dot.r)} fillOpacity={r1(dot.alpha)} {...rest} />;
}

function ClustersSvg({ layout, gridId }: { layout: ClustersLayout; gridId: string }) {
  const { width, height, pad, font, noise, groups, boundary, margin, leader, caption, hero, grid } = layout;
  const [accent, ...muted] = groups;
  const scatter = (dot: ClusterDot) => ({ "data-dot": true, "data-dx": `${r1(dot.sx - dot.x)}`, "data-dy": `${r1(dot.sy - dot.y)}` });

  return (
    <>
      <defs>
        <pattern id={gridId} width={grid.step} height={grid.step} x={grid.x} y={grid.y} patternUnits="userSpaceOnUse">
          <circle cx={grid.step / 2} cy={grid.step / 2} r={1} fill="currentColor" />
        </pattern>
      </defs>
      <rect data-grid x={pad} y={grid.top} width={width - pad * 2} height={height - grid.top - pad} fill={`url(#${gridId})`} opacity={0.7} />

      <g data-noise fill="currentColor">
        {noise.map((dot, i) => (
          <Dot key={i} dot={dot} />
        ))}
      </g>
      {muted.map((group, g) => (
        <g key={g} data-cluster data-origin={`${r1(group.cx)} ${r1(group.cy)}`} fill="currentColor" className="text-fg-muted">
          {group.dots.map((dot, i) => (
            <Dot key={i} dot={dot} {...scatter(dot)} />
          ))}
        </g>
      ))}
      <g data-cluster data-accent data-origin={`${r1(accent.cx)} ${r1(accent.cy)}`}>
        <path data-margin d={margin} stroke="currentColor" strokeDasharray="1 4" strokeLinecap="round" />
        <g className="fill-accent-ink">
          {accent.dots.map((dot, i) => (
            <Dot key={i} dot={dot} {...scatter(dot)} />
          ))}
        </g>
        <path data-boundary d={boundary} className="stroke-accent-ink" strokeWidth={STROKE[hero ? "hero" : "card"].accent} strokeLinejoin="round" />
      </g>
      <circle data-pen r={2.75} opacity={0} className="fill-accent-ink" />

      {caption.text ? (
        <>
          <path data-leader d={leader} stroke="currentColor" className="text-fg-muted" strokeOpacity={0.7} />
          <MicroLabel data-label="caption" size={font} x={r1(caption.x)} y={r1(caption.y)} textAnchor={caption.anchor}>
            {caption.text}
          </MicroLabel>
        </>
      ) : null}
      <MicroLabel data-label="corner" size={font} x={pad} y={r1(pad + font * 0.75)}>
        EMBEDDING SPACE
        {hero ? (
          <tspan className="fill-fg-subtle" dx={font * 0.6}>
            · 384-D
          </tspan>
        ) : null}
      </MicroLabel>
    </>
  );
}
