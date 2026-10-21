"use client";

import { useMemo, useRef } from "react";
import { EASE, gsap, useGSAP } from "@/lib/gsap";
import { HOLD, layoutAutoencoder, type AutoencoderLayout } from "./autoencoder-layout";
import {
  clamp,
  MicroLabel,
  playWithMotion,
  pointOnRoute,
  r1,
  useFrameSize,
  VisualFrame,
  type Playback,
  type Variant,
} from "./shared";

const INTRO_END = 1.5;

/**
 * Alert prioritization: an hourglass autoencoder. Alerts stream through the latent bottleneck;
 * most are reconstructed faithfully and leave unremarked, a few come out wrong and are flagged.
 */
export function AutoencoderVisual({ variant, className }: { variant: Variant; className?: string }) {
  const root = useRef<HTMLDivElement>(null);
  const played = useRef(false);
  const size = useFrameSize(root);
  const layout = useMemo(() => (size ? layoutAutoencoder(size, variant) : null), [size, variant]);

  useGSAP(
    (context) => {
      const el = root.current;
      if (!el || !layout) return;
      return playWithMotion(context, el, () => autoencoderTimeline(el, layout), played);
    },
    { scope: root, dependencies: [layout], revertOnUpdate: true },
  );

  return (
    <VisualFrame ref={root} size={size} variant={variant} className={className}>
      {layout ? <AutoencoderSvg layout={layout} /> : null}
    </VisualFrame>
  );
}

function autoencoderTimeline(el: HTMLElement, layout: AutoencoderLayout): Playback {
  const q = gsap.utils.selector(el);
  const tokens = q<SVGGElement>("[data-token]");
  const streaks = q<SVGPathElement>("[data-streak]");
  const pings = q<SVGCircleElement>("[data-ping]");

  /* ---------- Intro: the network assembles layer by layer; alerts fade in where they are. ---------- */
  const tl = gsap.timeline({ defaults: { ease: EASE.out } });
  tl.from("[data-edge]", { opacity: 0, duration: 1.1, ease: "none", stagger: 0.14 }, 0.1)
    .from("[data-lane]", { opacity: 0, duration: 1, ease: "none" }, 0.35)
    .from("[data-latent-ring]", { opacity: 0, scale: 0.4, transformOrigin: "50% 50%", duration: 1 }, 0.45)
    .from("[data-label]", { opacity: 0, y: 4, duration: 0.8, stagger: 0.08 }, 0.4)
    .from("[data-alert]", { opacity: 0, duration: 0.8, ease: "none", stagger: 0.04 }, 0.7);
  q("[data-layer]").forEach((layer, i) => {
    tl.from(
      layer.children,
      { scale: 0, transformOrigin: "50% 50%", duration: 0.6, stagger: { each: 0.035, from: "center" } },
      i * 0.12,
    );
  });

  /* ---------- Stream: starts in its steady state (the settled frame), every alert on its phase. ---------- */
  const { speed, period } = layout;
  const streakLength = clamp(layout.width * 0.05, 22, 48);
  const stream = gsap.timeline();

  layout.tokens.forEach((token, j) => {
    const { route, hot, outAt } = token;
    const L = route.length;
    const g = tokens[j];
    const streak = streaks[j];
    const flag = g.parentElement?.querySelector<SVGPathElement>("[data-flag]") ?? null;
    const marks = g.querySelectorAll("[data-hot], [data-ring]");
    const progress = { d: 0 };
    const move = () => {
      const d = progress.d;
      const [x, y] = pointOnRoute(route, d);
      g.setAttribute("transform", `translate(${r1(x)} ${r1(y)})`);
      const from = Math.max(0, d - streakLength);
      streak.style.strokeDasharray = `${r1(d - from)} ${r1(L + streakLength)}`;
      streak.style.strokeDashoffset = `${r1(-from)}`;
    };

    /** Travel from distance `from` to the end of the lane, then (flagged) stay docked for `dock` seconds. */
    const pass = (from: number, dock: number) => {
      const t = gsap.timeline();
      const time = (d: number) => (d - from) / speed;
      const end = time(L);
      if (end > 0) {
        t.fromTo(progress, { d: from }, { d: L, duration: end, ease: "none", onUpdate: move, immediateRender: false }, 0);
      }
      if (from === 0) t.fromTo(g, { opacity: 0 }, { opacity: 1, duration: 0.45, ease: "none", immediateRender: false }, 0);
      if (end > 0.6) t.fromTo(streak, { opacity: 0 }, { opacity: 1, duration: 0.45, ease: "none", immediateRender: false }, 0);
      // The bottleneck answers every alert that squeezes through it.
      const latentD = route.cumulative[3];
      if (latentD > from) {
        t.fromTo(
          pings[token.latent],
          { opacity: 0.7, scale: 1 },
          { opacity: 0, scale: 2.2, transformOrigin: "50% 50%", duration: 0.9, ease: EASE.out, immediateRender: false },
          time(latentD),
        );
      }
      if (!hot || !flag) {
        return t.to([g, streak], { opacity: 0, duration: Math.min(0.6, end), ease: "none" }, Math.max(0, end - 0.6));
      }

      if (outAt > from) {
        // Reconstruction fails at the output layer: flagged, traced in accent, docked for a beat.
        const at = time(outAt);
        t.set(marks, { opacity: 0 }, 0)
          .fromTo(marks[0], { opacity: 0 }, { opacity: 1, duration: 0.25, ease: "none", immediateRender: false }, at - 0.1)
          .fromTo(
            marks[1],
            { opacity: 0, scale: 0.3 },
            { opacity: 1, scale: 1, transformOrigin: "50% 50%", duration: 0.6, ease: EASE.out, immediateRender: false },
            at - 0.05,
          )
          .set(flag, { opacity: 1 }, at)
          .fromTo(flag, { drawSVG: "0%" }, { drawSVG: "100%", duration: end - at, ease: "none", immediateRender: false }, at);
      } else if (end > 0) {
        // Already flagged when the stream starts: the trace keeps pace with it.
        const drawn = ((from - outAt) / token.flagLength) * 100;
        t.fromTo(flag, { drawSVG: `0% ${drawn}%` }, { drawSVG: "0% 100%", duration: end, ease: "none", immediateRender: false }, 0);
      }
      if (end > 0.6) t.to(streak, { opacity: 0, duration: 0.4, ease: "none" }, end - 0.4);
      const fade = Math.min(0.7, end + dock);
      return t.to([g, flag], { opacity: 0, duration: fade, ease: "none" }, end + dock - fade);
    };

    // Finish the pass the alert is in when the stream starts, then relaunch on its phase forever.
    const cycleLength = L / speed + (hot ? HOLD : 0);
    if (token.local0 < cycleLength) {
      stream.add(pass(Math.min(token.local0 * speed, L), hot ? Math.min(HOLD, cycleLength - token.local0) : 0), 0);
    }
    const cycle = pass(0, HOLD);
    stream.add(
      gsap.timeline({ repeat: -1, repeatDelay: Math.max(0, period - cycle.duration()) }).add(cycle),
      period - token.local0,
    );
  });
  tl.add(stream, INTRO_END - 0.4);

  return {
    timeline: tl,
    introEnd: INTRO_END,
    // Back to the settled frame: alerts where the markup draws them, streak dashes cleared.
    reset: () => {
      layout.tokens.forEach(({ still }, j) => {
        tokens[j].setAttribute("transform", `translate(${r1(still.at[0])} ${r1(still.at[1])})`);
        streaks[j].style.removeProperty("stroke-dasharray");
        streaks[j].style.removeProperty("stroke-dashoffset");
      });
    },
  };
}

function AutoencoderSvg({ layout }: { layout: AutoencoderLayout }) {
  const { font, nodes, nodeR, ringR, edges, lanesIn, lanesOut, tokens, labels, legend } = layout;
  return (
    <>
      <g stroke="currentColor" strokeOpacity={0.26}>
        {edges.map((d, i) => (
          <path key={i} data-edge d={d} />
        ))}
      </g>
      <g stroke="currentColor" strokeDasharray="1 5" strokeLinecap="round">
        <path data-lane d={lanesIn} />
        <path data-lane d={lanesOut} />
      </g>

      {nodes[2].map(([x, y], i) => (
        <g key={i} className="text-fg-muted" stroke="currentColor">
          <circle data-latent-ring cx={r1(x)} cy={r1(y)} r={r1(ringR)} strokeOpacity={0.45} />
          <circle data-ping cx={r1(x)} cy={r1(y)} r={r1(ringR)} opacity={0} />
        </g>
      ))}
      {nodes.map((layer, i) => (
        <g key={i} data-layer fill="currentColor" className="text-fg-muted">
          {layer.map(([x, y], k) => (
            <circle key={k} cx={r1(x)} cy={r1(y)} r={r1(i === 2 ? nodeR * 1.3 : nodeR)} />
          ))}
        </g>
      ))}

      {tokens.map(({ d, hot, flagD, flagLength, still }, j) => (
        <g key={j} data-alert>
          <path data-streak d={d} opacity={0} stroke="currentColor" strokeLinecap="round" className="text-fg" strokeOpacity={0.4} />
          {hot ? (
            <path
              data-flag
              d={flagD}
              opacity={still.flagged ? 1 : 0}
              // Settled frame: the trace has only reached the alert so far.
              strokeDasharray={still.flagged && still.drawn < flagLength ? `${r1(still.drawn)} ${r1(flagLength)}` : undefined}
              className="stroke-accent-ink"
            />
          ) : null}
          <g data-token opacity={still.visible ? 1 : 0} transform={`translate(${r1(still.at[0])} ${r1(still.at[1])})`}>
            <circle r={2.6} fill="currentColor" className="text-fg" />
            {hot ? (
              <>
                <circle data-hot r={2.8} opacity={still.flagged ? 1 : 0} className="fill-accent-ink" />
                <circle data-ring r={7} opacity={still.flagged ? 1 : 0} className="stroke-accent-ink" />
              </>
            ) : null}
          </g>
        </g>
      ))}

      {labels.map((label) => (
        <MicroLabel key={label.text} data-label size={font} x={r1(label.x)} y={r1(label.y)} textAnchor={label.anchor}>
          {label.text}
        </MicroLabel>
      ))}
      {legend ? <circle data-label cx={r1(legend[0])} cy={r1(legend[1])} r={4} className="stroke-accent-ink" /> : null}
    </>
  );
}
