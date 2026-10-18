"use client";

import { useId, useMemo, useRef } from "react";
import { EASE, gsap, useGSAP } from "@/lib/gsap";
import { layoutPipeline, NODE_R, STILL_STAGE, type Label, type PipelineLayout } from "./pipeline-layout";
import {
  bindPlayback,
  clamp,
  Lattice,
  MicroLabel,
  r1,
  samplePath,
  STROKE,
  useFrameSize,
  VisualFrame,
  type Playback,
  type Pt,
  type Variant,
} from "./shared";

/**
 * MLOps pipeline: seven real stages connected in order. The hero adds the six label sources
 * converging into labeling and the daily-retrain loop. The pipeline draws itself on, then runs:
 * progress fills stage by stage and resets (card) or returns along the retrain loop (hero).
 */
export function PipelineVisual({ variant, className }: { variant: Variant; className?: string }) {
  const root = useRef<HTMLDivElement>(null);
  const played = useRef(false);
  const size = useFrameSize(root);
  const layout = useMemo(() => (size ? layoutPipeline(size, variant) : null), [size, variant]);
  const maskId = `pipeline-mask-${useId().replace(/[^\w-]/g, "")}`;

  useGSAP(
    () => {
      const el = root.current;
      if (!el || !layout) return;
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", (context) =>
        bindPlayback(el, context, () => pipelineTimeline(el, layout), played),
      );
    },
    { scope: root, dependencies: [layout], revertOnUpdate: true },
  );

  return (
    <VisualFrame ref={root} size={size} variant={variant} className={className}>
      {layout ? <PipelineSvg layout={layout} maskId={maskId} variant={variant} /> : null}
    </VisualFrame>
  );
}

function pipelineTimeline(el: HTMLElement, layout: PipelineLayout): Playback {
  const q = gsap.utils.selector(el);
  const stages = q<SVGGElement>("[data-stage]");
  const links = q<SVGPathElement>("[data-link]");
  const feeds = q<SVGPathElement>("[data-feed]");
  const particles = q<SVGCircleElement>("[data-particle]");
  const loop = q<SVGPathElement>("[data-loop]")[0];
  const reveal = q<SVGPathElement>("[data-loop-reveal]")[0];
  const progress = q<SVGPathElement>("[data-progress]")[0];
  const tail = q<SVGPathElement>("[data-tail]")[0];
  const pulse = q<SVGGElement>("[data-pulse]")[0];
  const pulseHome = pulse.getAttribute("transform") ?? "";
  const lits = stages.map((s) => s.querySelector("[data-lit]"));
  const still = q("[data-still]");
  // The settled run stays lit between runs (the next run draws over it); only the rest fades.
  const fading = lits.slice(STILL_STAGE + 1);
  const pings = stages.map((s) => s.querySelector("[data-ping]"));
  const nodes = stages.map((s) => s.querySelector("[data-node]"));

  // All geometry in one read pass, before anything is written: the run, loop and feeds become
  // lookup tables, so the pulse and particles move with writes only (no layout flush per frame).
  const run = samplePath(progress);
  const L = run.length;
  const stops = links
    .map((link) => link.getTotalLength())
    .reduce<number[]>((acc, len) => [...acc, acc[acc.length - 1] + len], [0]);
  const loopPath = loop ? samplePath(loop) : null;
  const revealLength = reveal ? reveal.getTotalLength() + 2 : 0;
  const feedPaths = feeds.map((feed) => samplePath(feed));

  gsap.set([...lits, pulse, still], { opacity: 0 });

  /* ---------- Intro: feeds converge, then one continuous stroke draws the stages in order. ---------- */
  const tl = gsap.timeline({ defaults: { ease: EASE.out } });
  tl.from("[data-lattice]", { opacity: 0, duration: 1.4, ease: "none" }, 0);
  let at = 0;
  if (feeds.length) {
    tl.from(q("[data-feed-label], [data-feed-dot]"), { opacity: 0, duration: 0.6, stagger: 0.06 }, 0).fromTo(
      feeds,
      { drawSVG: "0%" },
      { drawSVG: "100%", duration: 1.1, ease: EASE.inOut, stagger: 0.07 },
      0.25,
    );
    at = 0.7;
  }
  const build = 2.2 / L; // seconds per px: the whole run draws in 2.2s at any size
  stages.forEach((_, i) => {
    const t = at + stops[i] * build;
    tl.from(nodes[i], { scale: 0, transformOrigin: "50% 50%", duration: 0.6 }, t).from(
      q(`[data-label='${i}']`),
      { opacity: 0, y: 4, duration: 0.7, stagger: 0.05 },
      t + 0.05,
    );
    if (links[i]) {
      const span = (stops[i + 1] - stops[i]) * build;
      tl.fromTo(links[i], { drawSVG: "0%" }, { drawSVG: "100%", duration: span, ease: "none" }, t);
    }
  });
  let introEnd = at + 2.2 + 0.5;
  if (loop) {
    const t = at + 2.2;
    // Drawn on through a mask so the loop keeps its dashes (DrawSVG would make it solid).
    tl.fromTo(
      reveal,
      { strokeDasharray: `${revealLength} ${revealLength}`, strokeDashoffset: revealLength },
      { strokeDashoffset: 0, duration: 1.2, ease: EASE.inOut },
      t,
    )
      .from("[data-arrow]", { opacity: 0, duration: 0.3, ease: "none" }, t + 1.1)
      .from("[data-label='loop']", { opacity: 0, duration: 0.7 }, t + 0.6);
    introEnd = t + 1.4;
  }

  /* ---------- Run: progress fills the pipeline, every stage lights as it is reached. ---------- */
  const speed = clamp(layout.width * 0.13, 70, 160);
  const travel = L / speed;
  const head = { d: 0 };
  const placePulse = ([x, y]: Pt) => pulse.setAttribute("transform", `translate(${r1(x)} ${r1(y)})`);
  const renderRun = () => {
    progress.style.strokeDasharray = `${r1(head.d)} ${r1(L + 10)}`;
    placePulse(run.at(head.d));
  };
  const light = (i: number) => {
    const t = gsap.timeline();
    // Stages on the settled run are already lit; they only ping.
    if (i > STILL_STAGE) t.fromTo(lits[i], { opacity: 0 }, { opacity: 1, duration: 0.25, ease: "none", immediateRender: false });
    return t.fromTo(
        pings[i],
        { opacity: 0.85, scale: 1 },
        { opacity: 0, scale: 2.8, transformOrigin: "50% 50%", duration: 1.1, ease: EASE.out, immediateRender: false },
        0,
      );
  };

  // Hero: one label from each source flies in and lands on "labeling" as the run reaches it.
  const fly = 1.4;
  const reachLabeling = (stops[1] / L) * travel;
  const lead = particles.length ? Math.max(0, fly + 0.25 - reachLabeling) : 0;
  const cycle = gsap.timeline({ repeat: -1 });
  cycle
    .set(progress, { opacity: 1 }, lead)
    .fromTo(head, { d: 0 }, { d: L, duration: travel, ease: "none", onUpdate: renderRun, immediateRender: false }, lead);
  stops.forEach((s, i) => cycle.add(light(i), lead + (s / L) * travel));

  particles.forEach((dot, j) => {
    const feed = feedPaths[j];
    const pos = { d: 0 };
    const move = () => {
      const [x, y] = feed.at(pos.d);
      dot.setAttribute("transform", `translate(${r1(x)} ${r1(y)})`);
    };
    const start = Math.max(0, lead + reachLabeling - fly - (5 - j) * 0.04);
    cycle
      .fromTo(pos, { d: 0 }, { d: feed.length, duration: fly, ease: "power2.in", onUpdate: move, immediateRender: false }, start)
      .fromTo(dot, { opacity: 0 }, { opacity: 1, duration: 0.25, ease: "none", immediateRender: false }, start)
      .to(dot, { opacity: 0, duration: 0.2, ease: "none" }, start + fly - 0.15);
  });

  const end = lead + travel;
  if (loopPath) {
    // The pulse never leaves: it rides the retrain loop back to inventory and the next run departs.
    const LL = loopPath.length;
    const back = clamp(LL / (speed * 1.5), 1.2, 3);
    const tailLength = clamp(LL * 0.16, 30, 120);
    const lp = { d: 0 };
    const renderLoop = () => {
      placePulse(loopPath.at(lp.d));
      const from = Math.max(0, lp.d - tailLength);
      tail.style.strokeDasharray = `${r1(lp.d - from)} ${r1(LL + tailLength)}`;
      tail.style.strokeDashoffset = `${r1(-from)}`;
    };
    cycle
      .set(pulse, { opacity: 1 }, lead)
      .set(tail, { opacity: 1 }, end + 0.4)
      .fromTo(lp, { d: 0 }, { d: LL, duration: back, ease: "power1.inOut", onUpdate: renderLoop, immediateRender: false }, end + 0.4)
      .to([progress, ...fading], { opacity: 0, duration: 1, ease: "power1.inOut" }, end + 0.6)
      .to(tail, { opacity: 0, duration: 0.35, ease: "none" }, end + 0.4 + back - 0.15);
  } else {
    cycle
      .fromTo(pulse, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: "none", immediateRender: false }, lead)
      .to(pulse, { opacity: 0, duration: 0.4, ease: "none" }, end + 0.15)
      .to([progress, ...fading], { opacity: 0, duration: 0.9, ease: "power1.inOut" }, end + 1.3)
      .to({}, { duration: 0.6 }, end + 2.2);
  }
  // The settled run lights once, as the first run draws over it, and stays lit from then on.
  const reachStill = introEnd + lead + (stops[STILL_STAGE] / L) * travel;
  tl.to([still, ...lits.slice(0, STILL_STAGE + 1)], { opacity: 1, duration: 0.3, ease: "none" }, reachStill);
  tl.add(cycle, introEnd);

  return {
    timeline: tl,
    introEnd,
    reset: () => {
      pulse.setAttribute("transform", pulseHome);
      progress.style.removeProperty("stroke-dasharray");
      tail?.style.removeProperty("stroke-dasharray");
      tail?.style.removeProperty("stroke-dashoffset");
      particles.forEach((dot) => dot.removeAttribute("transform"));
    },
  };
}

function StageLabel({ label, font, index }: { label: Label; font: number; index: number | "loop" }) {
  const x = r1(label.x);
  const y = r1(label.y);
  return (
    <MicroLabel
      data-label={index}
      size={font}
      tone={label.subtle ? "subtle" : "muted"}
      x={x}
      y={y}
      textAnchor={label.anchor}
      transform={label.rotate ? `rotate(${label.rotate} ${x} ${y})` : undefined}
    >
      {label.ordinal ? (
        <>
          <tspan className="fill-fg-subtle">{label.ordinal}</tspan>
          <tspan dx={r1(label.text ? font * 0.8 : 0)}>{label.text}</tspan>
        </>
      ) : (
        label.text
      )}
    </MicroLabel>
  );
}

function PipelineSvg({ layout, maskId, variant }: { layout: PipelineLayout; maskId: string; variant: Variant }) {
  const { width, height, font, stages, links, run, stillRun, loop, feeds } = layout;
  const still = stages[STILL_STAGE];
  const pad = Math.min(width, height) * 0.05;
  return (
    <>
      <Lattice
        id={`${maskId}-lattice`}
        box={{ x: pad, y: pad, width: width - pad * 2, height: height - pad * 2 }}
        step={Math.round(clamp(Math.min(width, height) / 12, 18, 32))}
      />
      <defs>
        {loop ? (
          <mask id={`${maskId}-loop`} maskUnits="userSpaceOnUse" x={0} y={0} width={width} height={height}>
            <path data-loop-reveal d={loop.d} stroke="white" strokeWidth={6} fill="none" />
          </mask>
        ) : null}
        <mask id={maskId} maskUnits="userSpaceOnUse" x={0} y={0} width={width} height={height}>
          <rect width={width} height={height} fill="white" />
          {stages.map((s, i) => (
            <circle key={i} cx={r1(s.x)} cy={r1(s.y)} r={NODE_R + 4} fill="black" />
          ))}
        </mask>
      </defs>

      <g mask={`url(#${maskId})`} strokeLinecap="round">
        <g stroke="currentColor">
          {feeds.map((f, i) => (
            <path key={i} data-feed d={f.d} strokeOpacity={0.55} />
          ))}
          {links.map((d, i) => (
            <path key={i} data-link d={d} className="text-fg-muted" strokeOpacity={0.6} />
          ))}
          {loop ? <path data-loop d={loop.d} mask={`url(#${maskId}-loop)`} strokeDasharray="2 5" strokeOpacity={0.9} /> : null}
        </g>
        <g className="stroke-accent-ink" strokeWidth={STROKE[variant].accent}>
          {/* Settled frame: the run is part-way through the pipeline. */}
          <path data-still d={stillRun} />
          <path data-progress d={run} opacity={0} />
          {loop ? <path data-tail d={loop.d} opacity={0} /> : null}
        </g>
      </g>
      {loop ? <path data-arrow d={loop.arrow} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" /> : null}

      {feeds.map((f, i) => (
        <g key={i}>
          <circle data-feed-dot cx={r1(f.x)} cy={r1(f.y)} r={2} fill="currentColor" className="text-fg-muted" />
          <MicroLabel data-feed-label size={font} x={r1(f.label.x)} y={r1(f.label.y)} textAnchor="end">
            {f.label.text}
          </MicroLabel>
          <circle data-particle r={2} opacity={0} fill="currentColor" className="text-fg-muted" />
        </g>
      ))}

      {stages.map((s, i) => (
        <g key={i} data-stage>
          <g data-node className="text-fg-muted">
            <circle cx={r1(s.x)} cy={r1(s.y)} r={NODE_R} stroke="currentColor" />
            <circle cx={r1(s.x)} cy={r1(s.y)} r={1.6} fill="currentColor" />
          </g>
          <g data-lit opacity={i <= STILL_STAGE ? 1 : 0}>
            <circle cx={r1(s.x)} cy={r1(s.y)} r={NODE_R} className="fill-bg-sunken stroke-accent-ink" />
            <circle cx={r1(s.x)} cy={r1(s.y)} r={2.4} className="fill-accent-ink" />
          </g>
          <circle data-ping cx={r1(s.x)} cy={r1(s.y)} r={NODE_R} opacity={0} className="stroke-accent-ink" />
          {s.labels.map((label, j) => (
            <StageLabel key={j} label={label} font={font} index={i} />
          ))}
        </g>
      ))}

      <g data-pulse transform={`translate(${r1(still.x)} ${r1(still.y)})`} className="fill-accent-ink">
        <circle r={8} fillOpacity={0.16} />
        <circle r={2.75} />
      </g>
      {loop ? <StageLabel label={loop.label} font={font} index="loop" /> : null}
    </>
  );
}
