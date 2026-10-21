"use client";

import { useId, useMemo, useRef } from "react";
import { EASE, gsap, useGSAP } from "@/lib/gsap";
import { CALL_DOTS, GRAPH_STORE, layoutAgents, RUNS, type AgentsLayout, type Kind, type Node } from "./agents-layout";
import {
  clamp,
  Lattice,
  MicroLabel,
  playWithMotion,
  r1,
  samplePath,
  STROKE,
  useFrameSize,
  VisualFrame,
  type PathTable,
  type Playback,
  type Pt,
  type Variant,
} from "./shared";

/**
 * STREAM, drawn after Sabarish's own architecture diagram: a ticket is ingested and triaged (two
 * checks merging at dedup, which looks for a match in the data stores), the orchestrator hands it
 * to a product agent whose workflow calls MCP tools and intel sources, and the human in the loop
 * closes it. The diagram draws itself on, then follows one escalation at a time; the settled frame
 * waits on the human.
 */
export function AgentsVisual({ variant, className }: { variant: Variant; className?: string }) {
  const root = useRef<HTMLDivElement>(null);
  const played = useRef(false);
  const size = useFrameSize(root);
  const layout = useMemo(() => (size ? layoutAgents(size) : null), [size]);
  const maskId = `agents-mask-${useId().replace(/[^\w-]/g, "")}`;

  useGSAP(
    (context) => {
      const el = root.current;
      if (!el || !layout) return;
      return playWithMotion(context, el, () => agentsTimeline(el, layout), played);
    },
    { scope: root, dependencies: [layout], revertOnUpdate: true },
  );

  return (
    <VisualFrame ref={root} size={size} variant={variant} className={className}>
      {layout ? <AgentsSvg layout={layout} maskId={maskId} variant={variant} /> : null}
    </VisualFrame>
  );
}

/** Distance along a sampled path to the point nearest `target`. */
function distanceTo(table: PathTable, [x, y]: Pt) {
  let best = 0;
  let min = Infinity;
  for (let d = 0; d <= table.length; d += 2) {
    const [px, py] = table.at(d);
    const dist = (px - x) ** 2 + (py - y) ** 2;
    if (dist < min) {
      min = dist;
      best = d;
    }
  }
  return best;
}

function agentsTimeline(el: HTMLElement, layout: AgentsLayout): Playback {
  const q = gsap.utils.selector(el);
  const pulse = q<SVGGElement>("[data-pulse]")[0];
  const pulseHome = pulse.getAttribute("transform") ?? "";
  const children = q<SVGGElement>("[data-child]");
  const wait = q<SVGCircleElement>("[data-wait]")[0];
  const trails = q<SVGPathElement>("[data-trail]");
  const lits = q("[data-lit]");
  const zoneLits = q("[data-zone-lit]");
  const trail = (id: string) => q<SVGPathElement>(`[data-trail='${id}']`)[0];
  const part = (id: string, role: string) => q(`[data-node='${id}'] [data-${role}]`)[0];
  const at = new Map(layout.nodes.map((n) => [n.id, [n.x, n.y] as Pt]));
  const pos = (id: string): Pt => at.get(id) ?? layout.port;

  // All geometry in one read pass, before anything is written: every route a pulse rides becomes
  // a lookup table, so the pulses move with writes only (no layout flush per frame). The routes are
  // straight runs and wide corners, so 4px samples are exact to a fraction of a pixel.
  const ridden = new Set([
    ...["ingest", "structural", "semantic", "hub", "lookup", "human", "outcome-0", "outcome-1"],
    ...RUNS.flatMap(({ agent }) => [`agent-${agent}`, `flow-${agent}`, `mcp-${agent}`]),
  ]);
  const tables = new Map(
    trails.filter((path) => ridden.has(path.dataset.trail ?? "")).map((path) => [path.dataset.trail ?? "", samplePath(path, 4)]),
  );
  const table = (id: string) => tables.get(id) ?? samplePath(trail(id), 4);
  const ring = wait.getTotalLength();
  const share = (route: string, id: string) => distanceTo(table(route), pos(id)) / table(route).length;
  const ingestStops = ["webhook", "fetch", "parse", "embed"].map((id) => [id, share("ingest", id)] as const);
  const structuralAt = share("structural", "structural");
  const semanticAt = share("semantic", "semantic");

  // Hide the settled frame; the intro draws the empty diagram and each run lights it again.
  gsap.set([...lits, ...trails, ...zoneLits, wait, pulse], { opacity: 0 });

  /* ---------- Intro: zones fade in, then the wiring draws along the flow, nodes popping as it arrives. ---------- */
  const tl = gsap.timeline({ defaults: { ease: EASE.out } });
  const wires = (ids: string[]) => ids.map((id) => q(`[data-wire='${id}']`)[0]);
  const bases = (ids: string[]) => ids.map((id) => part(id, "base"));
  const labels = (ids: string[]) => ids.flatMap((id) => q(`[data-label='${id}']`));
  // Labels, captions and headings drop out on smaller frames: skip their tweens rather than hand
  // GSAP an empty target list (it warns).
  const from = (targets: Element[], vars: gsap.TweenVars, t: number) => void (targets.length && tl.from(targets, vars, t));
  const pop = (ids: string[], t: number, stagger = 0) => {
    from(bases(ids), { scale: 0, transformOrigin: "50% 50%", duration: 0.5, stagger }, t);
    from(labels(ids), { opacity: 0, y: 4, duration: 0.6, stagger }, t + 0.05);
  };
  const draw = (ids: string[], t: number, duration: number) =>
    tl.fromTo(wires(ids), { drawSVG: "0%" }, { drawSVG: "100%", duration, ease: "none" }, t);
  const rows = [0, 1, 2, 3, 4];
  const each = (prefix: string) => rows.map((k) => `${prefix}-${k}`);

  from(q("[data-lattice]"), { opacity: 0, duration: 1.4, ease: "none" }, 0);
  from(q("[data-zone]"), { opacity: 0, duration: 0.9, ease: "none", stagger: 0.08 }, 0.1);
  from(q("[data-caption]"), { opacity: 0, y: 4, duration: 0.7, stagger: 0.08 }, 0.25);
  draw(["ingest"], 0.3, 1);
  pop(["ticket"], 0.3);
  ingestStops.forEach(([id, f]) => pop([id], 0.3 + f));
  draw(["structural", "semantic"], 1.3, 0.8);
  pop(["structural", "semantic"], 1.3 + 0.8 * Math.min(structuralAt, semanticAt));
  pop(["dedup"], 2.05);
  draw(["hub"], 2.1, 0.45);
  from(wires(["lookup"]), { opacity: 0, duration: 0.5, ease: "none" }, 2.15);
  pop(["store-0", "store-1", "store-2", "store-3"], 2.3, 0.05);
  pop(["hub"], 2.5);
  draw([...each("agent"), "human"], 2.55, 0.6);
  pop(each("agent"), 3.05, 0.04);
  pop(["human"], 3.1);
  draw(each("flow"), 3.15, 0.3);
  pop(each("flow"), 3.35, 0.04);
  draw([...each("mcp"), "outcome-0", "outcome-1"], 3.4, 0.5);
  pop(["port"], 3.85);
  pop([...each("tool"), ...each("intel")], 3.6, 0.025);
  from(q("[data-pill]"), { opacity: 0, duration: 0.6, stagger: 0.1 }, 3.85);
  from(q("[data-header]"), { opacity: 0, duration: 0.6, stagger: 0.05 }, 3.6);
  const introEnd = 4.5;

  /* ---------- Loop: one escalation per run, from the ticket to the human's call. ---------- */
  const place = (target: SVGGElement, [x, y]: Pt) => target.setAttribute("transform", `translate(${r1(x)} ${r1(y)})`);
  const ping = (target: Element | undefined, scale = 2.6) =>
    gsap.fromTo(
      target ?? {},
      { opacity: 0.85, scale: 1 },
      { opacity: 0, scale, transformOrigin: "50% 50%", duration: 1.1, ease: EASE.out, immediateRender: false },
    );
  const light = (id: string, scale?: number) =>
    gsap
      .timeline()
      .fromTo(part(id, "lit") ?? {}, { opacity: 0 }, { opacity: 1, duration: 0.25, ease: "none", immediateRender: false }, 0)
      .add(ping(part(id, "ping"), scale), 0);
  const show = (target: Element | Element[], duration = 0.2) =>
    gsap.fromTo(target, { opacity: 0 }, { opacity: 1, duration, ease: "none", immediateRender: false });
  /** The dot rides a route; with `lit`, the route's trail draws behind it. */
  const ride = (id: string, duration: number, dot: SVGGElement, lit = true) => {
    const path = table(id);
    const head = { d: 0 };
    const t = gsap.timeline();
    if (lit) {
      t.fromTo(trail(id), { drawSVG: "0%" }, { drawSVG: "100%", duration, ease: "none", immediateRender: false }, 0).set(
        trail(id),
        { opacity: 1 },
        0,
      );
    }
    return t.fromTo(
      head,
      { d: 0 },
      { d: path.length, duration, ease: "none", immediateRender: false, onUpdate: () => place(dot, path.at(head.d)) },
      0,
    );
  };
  /** The dot rides a route backwards, over its lit trail. */
  const back = (id: string, duration: number, dot: SVGGElement) => {
    const path = table(id);
    const head = { d: path.length };
    return gsap.fromTo(
      head,
      { d: path.length },
      { d: 0, duration, ease: "none", immediateRender: false, onUpdate: () => place(dot, path.at(head.d)) },
    );
  };
  /** A call flies from the MCP port to a tool or intel source, on a curve that settles into its row. */
  const fly = (dot: SVGGElement, from: Pt, to: Pt, duration: number) => {
    const c: Pt = [from[0] + (to[0] - from[0]) * 0.25, to[1]];
    const p = { t: 0 };
    return gsap.fromTo(
      p,
      { t: 0 },
      {
        t: 1,
        duration,
        ease: "power1.inOut",
        immediateRender: false,
        onUpdate: () => {
          const u = 1 - p.t;
          const a = u * u;
          const b = 2 * u * p.t;
          const e = p.t * p.t;
          place(dot, [a * from[0] + b * c[0] + e * to[0], a * from[1] + b * c[1] + e * to[1]]);
        },
      },
    );
  };

  const cycle = gsap.timeline({ repeat: -1 });
  const [child] = children;
  let t = 0;
  for (const run of RUNS) {
    const k = run.agent;

    // 1. A ticket comes in and is fetched, parsed and embedded.
    const ingest = 1.6;
    cycle.add(show(pulse, 0.3), t).add(light("ticket"), t).add(ride("ingest", ingest, pulse), t);
    ingestStops.forEach(([id, f]) => cycle.add(light(id), t + ingest * f));
    t += ingest;

    // 2. Structural and semantic checks run side by side and meet at dedup.
    const lanes = 1.1;
    cycle
      .add(show(child, 0.15), t)
      .add(ride("structural", lanes, pulse), t)
      .add(ride("semantic", lanes, child), t)
      .add(light("structural"), t + lanes * structuralAt)
      .add(light("semantic"), t + lanes * semanticAt)
      .to(child, { opacity: 0, duration: 0.15, ease: "none" }, t + lanes - 0.1);
    t += lanes;
    cycle.add(light("dedup"), t);

    // 3. Dedup looks for an earlier match in the graph store: down and back.
    const look = 0.4;
    const store = `store-${GRAPH_STORE}`;
    cycle
      .add(show(child, 0.1), t + 0.1)
      .add(ride("lookup", look, child, false), t + 0.1)
      .add(show(trail("lookup"), look), t + 0.1)
      .add(show(q("[data-zone-lit='stores']"), 0.3), t + 0.2)
      .add(light(store), t + 0.1 + look)
      .add(back("lookup", look, child), t + 0.25 + look)
      .to(child, { opacity: 0, duration: 0.1, ease: "none" }, t + 0.2 + look * 2)
      .to(q("[data-zone-lit='stores']"), { opacity: 0, duration: 0.6, ease: "none" }, t + 0.3 + look * 2);
    t += 0.35 + look * 2;

    // 4. The orchestrator takes it and hands it to one product agent and its workflow.
    cycle.add(ride("hub", 0.6, pulse), t);
    t += 0.6;
    cycle.add(light("hub"), t);
    t += 0.2;
    cycle.add(ride(`agent-${k}`, 0.55, pulse), t);
    t += 0.55;
    cycle.add(light(`agent-${k}`), t).add(ride(`flow-${k}`, 0.3, pulse), t + 0.1);
    t += 0.4;
    cycle.add(light(`flow-${k}`), t).add(ride(`mcp-${k}`, 0.5, pulse), t + 0.1);
    t += 0.6;

    // 5. The workflow calls MCP tools and intel sources.
    const calls = [...run.tools.map((i) => `tool-${i}`), ...run.intel.map((i) => `intel-${i}`)];
    const flight = 0.45;
    cycle.add(light("port", 2), t).add(show(q("[data-zone-lit='mcp']"), 0.25), t);
    calls.forEach((id, i) => {
      const dot = children[i];
      const go = t + 0.1 + i * 0.16;
      cycle
        .add(show(dot, 0.1), go)
        .add(fly(dot, layout.port, pos(id), flight), go)
        .add(light(id), go + flight)
        .to(dot, { opacity: 0, duration: 0.15, ease: "none" }, go + flight);
    });
    t += 0.1 + (calls.length - 1) * 0.16 + flight + 0.35;
    cycle.add(ping(part("port", "ping"), 2), t).to(q("[data-zone-lit='mcp']"), { opacity: 0, duration: 0.6, ease: "none" }, t);

    // 6. The findings go back to the orchestrator.
    cycle
      .add(back(`mcp-${k}`, 0.4, pulse), t)
      .add(back(`flow-${k}`, 0.2, pulse), t + 0.4)
      .add(back(`agent-${k}`, 0.4, pulse), t + 0.6);
    t += 1;
    cycle.add(ping(part("hub", "ping")), t);

    // 7. The human in the loop reviews (the ring fills), then acts: update the ticket or assign a researcher.
    cycle.add(ride("human", 0.6, pulse), t + 0.1);
    t += 0.7;
    const review = 1.2;
    cycle
      .add(light("human"), t)
      .set(wait, { opacity: 1, strokeDasharray: `${r1(ring)} ${r1(ring)}`, strokeDashoffset: r1(ring) }, t)
      .to(wait, { strokeDashoffset: 0, duration: review, ease: "power1.inOut" }, t);
    t += review;
    const outcome = `outcome-${run.outcome}`;
    // The muted label under the lit pill hides once the pill is solid and returns after it fades,
    // so the fade-out never cross-fades two labels (dark on accent into grey on dark).
    const muted = q(`[data-node='${outcome}'] [data-pill-text]`);
    cycle.add(ride(outcome, 0.35, pulse), t);
    t += 0.35;
    cycle.add(light(outcome, 1.25), t).to(pulse, { opacity: 0, duration: 0.3, ease: "none" }, t + 0.05);
    if (muted.length) cycle.set(muted, { opacity: 0 }, t + 0.25).to(muted, { opacity: 1, duration: 0.4, ease: "none" }, t + 1.7);

    // 8. Everything settles for the next escalation.
    cycle.to([...trails, ...lits, wait], { opacity: 0, duration: 0.8, ease: "power1.inOut" }, t + 1.1);
    t += 2.3;
  }
  // Hold the last run's rest too: a repeating timeline wraps where its last tween ends.
  cycle.set({}, {}, t);
  tl.add(cycle, introEnd);

  return {
    timeline: tl,
    introEnd,
    reset: () => {
      pulse.setAttribute("transform", pulseHome);
      children.forEach((dot) => dot.removeAttribute("transform"));
    },
  };
}

const diamond = (x: number, y: number, r: number) =>
  `M${r1(x)} ${r1(y - r)}L${r1(x + r)} ${r1(y)}L${r1(x)} ${r1(y + r)}L${r1(x - r)} ${r1(y)}Z`;

/** A data store: a cylinder, r wide either side of centre and 1.2 r tall. */
function Cylinder({ x, y, r, className }: { x: number; y: number; r: number; className?: string }) {
  const h = r * 1.2;
  const e = r * 0.36;
  const body = `M${r1(x - r)} ${r1(y - h + e)}V${r1(y + h - e)}A${r1(r)} ${r1(e)} 0 0 0 ${r1(x + r)} ${r1(y + h - e)}V${r1(y - h + e)}`;
  return (
    <g className={className}>
      <path d={body} />
      <ellipse cx={r1(x)} cy={r1(y - h + e)} rx={r1(r)} ry={r1(e)} />
    </g>
  );
}

const ROUND: readonly Kind[] = ["step", "hub", "agent", "intel", "human", "gate"];

/** One node: its muted outline, the lit version the runs switch on, and the ring that pings. */
function NodeGlyph({ node, font }: { node: Node; font: number }) {
  const { id, kind, r, label, still } = node;
  const x = r1(node.x);
  const y = r1(node.y);
  const square = (side: number, className?: string) => (
    <rect
      x={r1(x - side)}
      y={r1(y - side)}
      width={r1(side * 2)}
      height={r1(side * 2)}
      rx={1.5}
      stroke={className ? undefined : "currentColor"}
      className={className}
    />
  );
  let base;
  let lit;
  switch (kind) {
    case "gate":
      base = (
        <>
          <path d={diamond(x, y, r)} stroke="currentColor" strokeLinejoin="round" />
          <circle cx={x} cy={y} r={1.6} fill="currentColor" />
        </>
      );
      lit = (
        <>
          <path d={diamond(x, y, r)} strokeLinejoin="round" className="fill-bg-sunken stroke-accent-ink" />
          <circle cx={x} cy={y} r={2.4} className="fill-accent-ink" />
        </>
      );
      break;
    case "hub":
      base = (
        <>
          <circle cx={x} cy={y} r={r} stroke="currentColor" />
          <circle cx={x} cy={y} r={r1(r * 0.62)} stroke="currentColor" strokeOpacity={0.6} />
          <circle cx={x} cy={y} r={2} fill="currentColor" />
        </>
      );
      lit = (
        <>
          <circle cx={x} cy={y} r={r} className="fill-bg-sunken stroke-accent-ink" />
          <circle cx={x} cy={y} r={r1(r * 0.62)} className="stroke-accent-ink" strokeOpacity={0.6} />
          <circle cx={x} cy={y} r={3} className="fill-accent-ink" />
        </>
      );
      break;
    case "flow":
      base = (
        <>
          {square(r)}
          <rect x={r1(x - 1.5)} y={r1(y - 1.5)} width={3} height={3} fill="currentColor" />
        </>
      );
      lit = (
        <>
          {square(r, "fill-bg-sunken stroke-accent-ink")}
          <rect x={r1(x - 2)} y={r1(y - 2)} width={4} height={4} className="fill-accent-ink" />
        </>
      );
      break;
    case "tool":
      base = square(r);
      lit = square(r, "fill-accent-ink stroke-accent-ink");
      break;
    case "intel":
      base = <circle cx={x} cy={y} r={r} stroke="currentColor" />;
      lit = <circle cx={x} cy={y} r={r} className="fill-accent-ink stroke-accent-ink" />;
      break;
    case "store":
      base = <Cylinder x={x} y={y} r={r} className="stroke-current" />;
      lit = <Cylinder x={x} y={y} r={r} className="fill-bg-sunken stroke-accent-ink" />;
      break;
    default:
      // Ticket steps, product agents and the human in the loop: a ring with a dot.
      base = (
        <>
          <circle cx={x} cy={y} r={r} stroke="currentColor" />
          <circle cx={x} cy={y} r={1.6} fill="currentColor" />
        </>
      );
      lit = (
        <>
          <circle cx={x} cy={y} r={r} className="fill-bg-sunken stroke-accent-ink" />
          <circle cx={x} cy={y} r={2.4} className="fill-accent-ink" />
        </>
      );
  }
  return (
    <>
      <g data-node={id}>
        <g data-base className="text-fg-muted">
          {base}
        </g>
        <g data-lit opacity={still ? 1 : 0}>
          {lit}
        </g>
        {ROUND.includes(kind) || kind === "store" ? (
          <circle data-ping cx={x} cy={y} r={kind === "store" ? r * 1.2 : r} opacity={0} className="stroke-accent-ink" />
        ) : (
          <rect
            data-ping
            x={r1(x - r)}
            y={r1(y - r)}
            width={r1(r * 2)}
            height={r1(r * 2)}
            rx={1.5}
            opacity={0}
            className="stroke-accent-ink"
          />
        )}
      </g>
      {label ? (
        <MicroLabel data-label={id} size={font} x={r1(label.x)} y={r1(label.y)} textAnchor={label.anchor}>
          {label.text}
        </MicroLabel>
      ) : null}
    </>
  );
}

function AgentsSvg({ layout, maskId, variant }: { layout: AgentsLayout; maskId: string; variant: Variant }) {
  const { width, height, font, stroke, dash, zones, routes, nodes, pills, headers, port, wait, pulse } = layout;
  const pad = Math.min(width, height) * 0.05;
  const waitC = 2 * Math.PI * wait.r;
  return (
    <g strokeWidth={STROKE[variant].base * stroke}>
      <Lattice
        id={`${maskId}-lattice`}
        box={{ x: pad, y: pad, width: width - pad * 2, height: height - pad * 2 }}
        step={Math.round(clamp(Math.min(width, height) / 12, 18, 32))}
      />
      <defs>
        {/* Wires stop short of the nodes they join. */}
        <mask id={maskId} maskUnits="userSpaceOnUse" x={0} y={0} width={width} height={height}>
          <rect width={width} height={height} fill="white" />
          {nodes.map((n) =>
            n.kind === "tool" || n.kind === "intel" ? null : n.kind === "flow" || n.kind === "store" ? (
              <rect
                key={n.id}
                x={r1(n.x - n.r - 3.5)}
                y={r1(n.y - n.r * (n.kind === "store" ? 1.2 : 1) - 3.5)}
                width={r1(n.r * 2 + 7)}
                height={r1(n.r * (n.kind === "store" ? 2.4 : 2) + 7)}
                fill="black"
              />
            ) : (
              <circle key={n.id} cx={r1(n.x)} cy={r1(n.y)} r={r1(n.r + 3.5)} fill="black" />
            ),
          )}
          {pills.map((p) => (
            <rect
              key={p.id}
              x={r1(p.x - 3.5)}
              y={r1(p.y - 3.5)}
              width={r1(p.w + 7)}
              height={r1(p.h + 7)}
              rx={r1(p.h / 2 + 3.5)}
              fill="black"
            />
          ))}
        </mask>
      </defs>

      {/* Zones: dashed, chamfered like the site's cards. Stores and MCP flash when they're called. */}
      <g strokeDasharray={dash}>
        {zones.map((z) => (
          <path key={z.id} data-zone d={z.d} stroke="currentColor" className="fill-fg" fillOpacity={0.025} />
        ))}
        {zones
          .filter((z) => z.id === "stores" || z.id === "mcp")
          .map((z) => (
            <path key={z.id} data-zone-lit={z.id} d={z.d} opacity={0} className="stroke-accent-ink" />
          ))}
      </g>
      {zones.map((z) =>
        z.caption ? (
          <MicroLabel key={z.id} data-caption size={font} x={r1(z.caption.x)} y={r1(z.caption.y)}>
            {z.caption.text}
          </MicroLabel>
        ) : null,
      )}

      <g mask={`url(#${maskId})`} strokeLinecap="round" strokeLinejoin="round">
        <g stroke="currentColor">
          {routes.map((r) => (
            <path key={r.id} data-wire={r.id} d={r.d} strokeDasharray={r.dashed ? "2 4" : undefined} />
          ))}
        </g>
        <g className="stroke-accent-ink" strokeWidth={STROKE[variant].accent * stroke}>
          {/* Settled frame: run 0 has been through every step and waits on the human. */}
          {routes.map((r) => (
            <path key={r.id} data-trail={r.id} d={r.d} strokeDasharray={r.dashed ? "2 4" : undefined} opacity={r.still ? 1 : 0} />
          ))}
        </g>
      </g>

      {nodes.map((n) => (
        <NodeGlyph key={n.id} node={n} font={font} />
      ))}

      <g data-node="port">
        <g data-base className="text-fg-muted">
          <circle cx={r1(port[0])} cy={r1(port[1])} r={2.5} fill="currentColor" />
        </g>
        <g data-lit>
          <circle cx={r1(port[0])} cy={r1(port[1])} r={3} className="fill-accent-ink" />
        </g>
        <circle data-ping cx={r1(port[0])} cy={r1(port[1])} r={3} opacity={0} className="stroke-accent-ink" />
      </g>

      {pills.map((p) => (
        <g key={p.id} data-pill>
          <g data-node={p.id}>
            <g className="text-fg-muted">
              <rect x={r1(p.x)} y={r1(p.y)} width={r1(p.w)} height={r1(p.h)} rx={r1(p.h / 2)} stroke="currentColor" />
              {p.label ? (
                <MicroLabel data-pill-text size={font} x={r1(p.label.x)} y={r1(p.label.y)} textAnchor="middle">
                  {p.label.text}
                </MicroLabel>
              ) : null}
            </g>
            <g data-lit opacity={0}>
              <rect x={r1(p.x)} y={r1(p.y)} width={r1(p.w)} height={r1(p.h)} rx={r1(p.h / 2)} className="fill-accent" />
              {p.label ? (
                <text
                  x={r1(p.label.x)}
                  y={r1(p.label.y)}
                  textAnchor="middle"
                  fontSize={font}
                  letterSpacing="0.08em"
                  className="fill-on-accent font-mono"
                >
                  {p.label.text}
                </text>
              ) : null}
            </g>
            <rect
              data-ping
              x={r1(p.x)}
              y={r1(p.y)}
              width={r1(p.w)}
              height={r1(p.h)}
              rx={r1(p.h / 2)}
              opacity={0}
              className="stroke-accent-ink"
            />
          </g>
        </g>
      ))}

      {headers.map((h) => (
        <MicroLabel key={h.text} data-header tone="subtle" size={font} x={r1(h.x)} y={r1(h.y)} textAnchor={h.anchor}>
          {h.text}
        </MicroLabel>
      ))}

      <circle
        data-wait
        cx={r1(wait.x)}
        cy={r1(wait.y)}
        r={r1(wait.r)}
        strokeDasharray={`${r1(waitC * 0.62)} ${r1(waitC)}`}
        transform={`rotate(-90 ${r1(wait.x)} ${r1(wait.y)})`}
        className="stroke-accent-ink"
      />

      <g data-pulse transform={`translate(${r1(wait.x)} ${r1(wait.y)})`} className="fill-accent-ink">
        <circle r={pulse.halo} fillOpacity={0.16} />
        <circle r={pulse.core} />
      </g>
      {Array.from({ length: CALL_DOTS }, (_, i) => (
        <g key={i} data-child opacity={0} className="fill-accent-ink">
          <circle r={r1(pulse.halo * 0.75)} fillOpacity={0.16} />
          <circle r={r1(pulse.core * 0.8)} />
        </g>
      ))}
    </g>
  );
}
