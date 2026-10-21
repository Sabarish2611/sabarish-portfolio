import { clamp, cubicD, LABEL_SIZE, r1, textWidth, type Pt, type Size } from "./shared";

/**
 * STREAM's architecture, after Sabarish's own architecture diagram, with generic labels only. Tickets are ingested
 * (webhook, fetch) and triaged: parsed, embedded, checked two ways (structural, semantic) and
 * deduplicated against the data stores. The orchestrator hands each one to a product agent and its
 * workflow, which call MCP tools and intel sources, and a human-in-the-loop agent closes it
 * (update the ticket, or assign a researcher).
 *
 * Drawn on a fixed blueprint (BW × BH units) scaled uniformly into the frame; strokes and type stay
 * at their CSS px sizes, so labels show only where they fit at the current scale.
 */
const BW = 1010;
const BH = 580;

/** Rows of the five product agents, their workflows, and the MCP tools and intel sources. */
const ROWS = [95, 165, 235, 305, 375] as const;
const AGENT_X = 680;
/** Right edge of the product agents' zone. */
const AGENTS_EDGE = 815;
const FLOW_X = 765;
const TOOL_X = 893;
const INTEL_X = 955;
/** Orchestrator → product agents and the human step. */
const BUS_X = 628;
/** Workflows → MCP. */
const MCP_BUS_X = 835;
const PORT: Pt = [860, 235];
const HUB: Pt = [534, 355];
const EMBED: Pt = [290, 240];
const DEDUP: Pt = [290, 355];
const HUMAN: Pt = [680, 503];
const STORE_Y = 500;
const storeX = (i: number) => 90 + i * 100;
const STORES = ["WAREHOUSE", "OBJECTS", "GRAPH", "LOCAL DB"] as const;
/** The store dedup checks for an earlier, matching ticket. */
export const GRAPH_STORE = 2;
const PILL_X = 740;
const PILL_Y = [480, 528] as const;
const SPLIT_X = 712;

/**
 * One escalation per run: the product agent the orchestrator picks, the MCP tools and intel
 * sources its workflow calls, and the human's outcome (0 update the ticket, 1 assign a researcher).
 */
export const RUNS = [
  { agent: 1, tools: [0, 3], intel: [2], outcome: 0 },
  { agent: 3, tools: [4], intel: [0, 3], outcome: 1 },
  { agent: 0, tools: [1, 2], intel: [4], outcome: 0 },
] as const;

/** The settled frame (reduced motion, no JS): run 0, waiting on the human. */
const STILL = RUNS[0];

/** Flying dots: one per MCP call in the busiest run. Dot 0 also rides the semantic lane and the store lookup. */
export const CALL_DOTS = Math.max(1, ...RUNS.map((run) => run.tools.length + run.intel.length));

export type Kind = "step" | "gate" | "hub" | "agent" | "flow" | "tool" | "intel" | "store" | "human";
export type Label = { x: number; y: number; anchor: "start" | "middle"; text: string };
export type Node = { id: string; kind: Kind; x: number; y: number; r: number; label: Label | null; still: boolean };
export type Route = { id: string; d: string; dashed?: boolean; still: boolean };
/** A dashed zone, chamfered like the site's cards, its caption set into the top edge. */
export type Zone = { id: string; d: string; caption: Label | null };
export type Pill = { id: string; x: number; y: number; w: number; h: number; label: Label | null };

export type AgentsLayout = {
  width: number;
  height: number;
  font: number;
  /** Stroke weight multiplier: lighter lines on the smallest frames. */
  stroke: number;
  /** Dash pattern of the zone outlines. */
  dash: string;
  zones: readonly Zone[];
  routes: readonly Route[];
  nodes: readonly Node[];
  pills: readonly Pill[];
  /** Column headings inside the agent and MCP zones, where they fit. */
  headers: readonly Label[];
  port: Pt;
  /** The ring that fills while the human reviews (part-filled in the settled frame). */
  wait: { x: number; y: number; r: number };
  pulse: { halo: number; core: number };
};

/** Rounded orthogonal path through `points`: each corner eased with a quadratic of radius r. */
function elbow(input: readonly Pt[], r: number) {
  const points = input.filter((p, i) => i === 0 || p[0] !== input[i - 1][0] || p[1] !== input[i - 1][1]);
  let d = `M${r1(points[0][0])} ${r1(points[0][1])}`;
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = points[i - 1];
    const [x, y] = points[i];
    const [nx, ny] = points[i + 1];
    const inLen = Math.hypot(x - px, y - py);
    const outLen = Math.hypot(nx - x, ny - y);
    const k = Math.min(r, inLen / 2, outLen / 2);
    const a: Pt = [x - ((x - px) / inLen) * k, y - ((y - py) / inLen) * k];
    const b: Pt = [x + ((nx - x) / outLen) * k, y + ((ny - y) / outLen) * k];
    d += `L${r1(a[0])} ${r1(a[1])}Q${r1(x)} ${r1(y)} ${r1(b[0])} ${r1(b[1])}`;
  }
  const last = points[points.length - 1];
  return `${d}L${r1(last[0])} ${r1(last[1])}`;
}

export function layoutAgents({ width, height }: Size): AgentsLayout {
  const font = LABEL_SIZE;
  const pad = clamp(Math.min(width, height) * 0.05, 10, 32);
  const sx = (width - pad * 2) / BW;
  const sy = (height - pad * 2) / BH;
  const s = Math.min(sx, sy);
  // Frames taller than the blueprint (the home card from lg up, phones) spread it vertically
  // instead of letterboxing it: rows and zones space out, nodes and type keep their size.
  const stretch = clamp(sy / s, 1, 2.2);
  const ox = (width - BW * s) / 2;
  const oy = (height - BH * s * stretch) / 2;
  const P = ([x, y]: Pt): Pt => [ox + x * s, oy + y * s * stretch];
  const R = (units: number, min: number, max: number) => clamp(units * s, min, max);
  const tw = (text: string) => textWidth(text, font);
  // Node labels from about two-thirds scale (card and hero from md up); column headings and store
  // names only on the larger frames.
  const labels = s >= 0.6;
  const details = s >= 0.78;
  // Zone captions from just under the label scale; on phones the 12px type would swamp the diagram.
  const captions = s >= 0.45;

  /* ---------- Zones ---------- */
  const cut = R(14, 5, 14);
  // `limit`: where a line crosses the top edge, so the caption stops short of it.
  const zone = (id: string, [x, y]: Pt, w: number, h: number, names: readonly string[], limit = x + w): Zone => {
    const [zx, zy] = P([x, y]);
    const zw = w * s;
    const zh = h * s * stretch;
    const inset = 8;
    const gap = 6;
    const room = Math.min(zw - cut, (limit - x) * s - 8) - 4;
    const text = captions ? (names.find((name) => inset + gap * 2 + tw(name) <= room) ?? null) : null;
    const end = text ? zx + inset + gap * 2 + tw(text) : zx;
    // Clockwise from the caption's far end, so the top edge breaks around the caption.
    const d =
      `M${r1(end)} ${r1(zy)}H${r1(zx + zw - cut)}L${r1(zx + zw)} ${r1(zy + cut)}V${r1(zy + zh)}` +
      `H${r1(zx + cut)}L${r1(zx)} ${r1(zy + zh - cut)}V${r1(zy)}${text ? `H${r1(zx + inset)}` : "Z"}`;
    return { id, d, caption: text ? { x: zx + inset + gap, y: zy + font * 0.36, anchor: "start", text } : null };
  };
  const zones = [
    zone("ingest", [20, 30], 420, 95, ["INGEST"]),
    zone("triage", [20, 160], 420, 245, ["TRIAGE"], 375),
    zone("stores", [20, 445], 420, 115, ["DATA STORES", "STORES"], DEDUP[0]),
    zone("agents", [640, 30], AGENTS_EDGE - 640, 375, ["PRODUCT AGENTS", "AGENTS"]),
    zone("mcp", [860, 30], 130, 375, ["MCP"]),
    zone("human", [640, 445], 350, 115, ["HUMAN IN THE LOOP", "HITL"]),
  ];

  /* ---------- Nodes ---------- */
  const radius: Record<Kind, number> = {
    step: R(5, 2.5, 6),
    gate: R(10, 4.5, 11),
    hub: R(18, 8, 22),
    agent: R(7, 3, 8),
    flow: R(6.5, 3, 7.5),
    tool: R(6, 2.75, 7),
    intel: R(6.5, 3, 7.5),
    store: R(9, 4, 10),
    human: R(11, 5, 12),
  };
  const node = (id: string, kind: Kind, at: Pt, still: boolean, text?: string | null, side: "above" | "below" = "above"): Node => {
    const [x, y] = P(at);
    const r = kind === "store" ? radius.store * 1.2 : radius[kind];
    const label: Label | null = text
      ? side === "above"
        ? { x, y: y - r - 8, anchor: "middle", text }
        : { x, y: y + r + 8 + font * 0.74, anchor: "middle", text }
      : null;
    return { id, kind, x, y, r: radius[kind], label, still };
  };
  const step = (id: string, at: Pt, text: string, side: "above" | "below" = "above") =>
    node(id, "step", at, true, labels ? text : null, side);
  // The orchestrator's label sits between the triage zone and the agents' bus; it shows where it fits.
  const hubRoom = Math.min(HUB[0] - 440, BUS_X - HUB[0]) * s - 8;
  // Store names show all together or not at all: each clear of its neighbours and the zone's edges.
  const storeNames =
    details &&
    STORES.every(
      (name, i) =>
        (i === 0 ? tw(name) / 2 + 4 <= (storeX(0) - 20) * s : (tw(STORES[i - 1]) + tw(name)) / 2 + 8 <= 100 * s) &&
        (i < STORES.length - 1 || tw(name) / 2 + 4 <= (440 - storeX(i)) * s),
    );

  const nodes: Node[] = [
    step("ticket", [85, 88], "TICKET"),
    step("webhook", [230, 88], "WEBHOOK"),
    step("fetch", [375, 88], "FETCH"),
    step("parse", [375, 240], "PARSE", "below"),
    step("embed", EMBED, "EMBED"),
    step("structural", [165, 218], "STRUCTURAL"),
    step("semantic", [165, 262], "SEMANTIC", "below"),
    node("dedup", "gate", DEDUP, true, labels ? "DEDUP" : null),
    ...STORES.map((name, i) =>
      node(`store-${i}`, "store", [storeX(i), STORE_Y], i === GRAPH_STORE, storeNames ? name : null, "below"),
    ),
    node("hub", "hub", HUB, true, labels && tw("ORCHESTRATOR") / 2 <= hubRoom ? "ORCHESTRATOR" : null),
    ...ROWS.map((y, k) => node(`agent-${k}`, "agent", [AGENT_X, y], k === STILL.agent)),
    ...ROWS.map((y, k) => node(`flow-${k}`, "flow", [FLOW_X, y], k === STILL.agent)),
    ...ROWS.map((y, k) => node(`tool-${k}`, "tool", [TOOL_X, y], (STILL.tools as readonly number[]).includes(k))),
    ...ROWS.map((y, k) => node(`intel-${k}`, "intel", [INTEL_X, y], (STILL.intel as readonly number[]).includes(k))),
    node("human", "human", HUMAN, true),
  ];

  // Column headings, both pairs or neither.
  const pairs: [string, number, string, number, number][] = [
    ["AGENT", AGENT_X, "WORKFLOW", FLOW_X, AGENTS_EDGE],
    ["TOOLS", TOOL_X, "INTEL", INTEL_X, 990],
  ];
  const headingY = P([0, 66])[1];
  const headers: Label[] =
    details && pairs.every(([a, ax, b, bx, edge]) => (tw(a) + tw(b)) / 2 + 6 <= (bx - ax) * s && tw(b) / 2 + 4 <= (edge - bx) * s)
      ? pairs.flatMap(([a, ax, b, bx]): Label[] => [
          { x: P([ax, 0])[0], y: headingY, anchor: "middle", text: a },
          { x: P([bx, 0])[0], y: headingY, anchor: "middle", text: b },
        ])
      : [];

  /* ---------- Outcomes ---------- */
  const pillPad = 8;
  const pillRoom = (990 - PILL_X) * s - 6;
  const texts = labels
    ? ([
        ["UPDATE TICKET", "ASSIGN RESEARCHER"],
        ["UPDATE", "ASSIGN"],
      ].find((set) => set.every((text) => tw(text) + pillPad * 2 <= pillRoom)) ?? null)
    : null;
  const pillH = texts ? 22 : R(14, 5, 14);
  const pills: Pill[] = PILL_Y.map((y, p) => {
    const [x, cy] = P([PILL_X, y]);
    const w = texts ? tw(texts[p]) + pillPad * 2 : R(110, 22, 120);
    return {
      id: `outcome-${p}`,
      x,
      y: cy - pillH / 2,
      w,
      h: pillH,
      label: texts ? { x: x + w / 2, y: cy + font * 0.36, anchor: "middle", text: texts[p] } : null,
    };
  });

  /* ---------- Routes ---------- */
  const corner = R(10, 3, 12);
  const E = (points: readonly Pt[]) => elbow(points.map(P), corner);
  const join = (head: string, tail: string) => head + tail.replace(/^M[^A-Za-z]*/, "");
  // Embed forks into the two checks (clear of its label), which run left, turn down and merge on
  // the way to dedup.
  const fork = (y: number) =>
    join(E([EMBED, [262, 240]]), cubicD(P([262, 240]), P([247, 240]), P([247, y]), P([232, y])));
  const routes: Route[] = [
    { id: "ingest", d: E([[85, 88], [375, 88], [375, 240], EMBED]), still: true },
    { id: "structural", d: join(fork(218), E([[232, 218], [55, 218], [55, 355], DEDUP])), still: true },
    { id: "semantic", d: join(fork(262), E([[232, 262], [95, 262], [95, 355], DEDUP])), still: true },
    { id: "hub", d: E([DEDUP, HUB]), still: true },
    { id: "lookup", d: E([DEDUP, [storeX(GRAPH_STORE), STORE_Y]]), dashed: true, still: true },
    ...ROWS.map((y, k) => ({ id: `agent-${k}`, d: E([HUB, [BUS_X, HUB[1]], [BUS_X, y], [AGENT_X, y]]), still: k === STILL.agent })),
    ...ROWS.map((y, k) => ({ id: `flow-${k}`, d: E([[AGENT_X, y], [FLOW_X, y]]), still: k === STILL.agent })),
    ...ROWS.map((y, k) => ({
      id: `mcp-${k}`,
      d: E([[FLOW_X, y], [MCP_BUS_X, y], [MCP_BUS_X, PORT[1]], PORT]),
      still: k === STILL.agent,
    })),
    { id: "human", d: E([HUB, [BUS_X, HUB[1]], [BUS_X, HUMAN[1]], HUMAN]), still: true },
    ...PILL_Y.map((y, p) => ({ id: `outcome-${p}`, d: E([HUMAN, [SPLIT_X, HUMAN[1]], [SPLIT_X, y], [PILL_X, y]]), still: false })),
  ];

  return {
    width,
    height,
    font,
    stroke: clamp(s * 1.6, 0.67, 1),
    dash: s < 0.5 ? "2 3" : "3 4",
    zones,
    routes,
    nodes,
    pills,
    headers,
    port: P(PORT),
    wait: { x: P(HUMAN)[0], y: P(HUMAN)[1], r: radius.human + R(5, 3, 5) },
    pulse: { halo: R(8, 5, 8), core: R(2.75, 1.75, 2.75) },
  };
}
