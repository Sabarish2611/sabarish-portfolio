import { clamp, cubicAt, cubicD, LABEL_SIZE, r1, seeded, shuffle, textWidth, type Pt, type Size, type Variant } from "./shared";

/**
 * Multilingual URL categorization: URL tokens in six scripts ride their own lanes into one shared
 * (language-agnostic) embedding, then land in one of 60 category cells (60 is real). Each lap a
 * token lands in a different category, and cells keep a slowly fading glow: a calm heatmap of
 * recent decisions. Flow coordinates: u runs with the stream, v across it; portrait frames turn it.
 */
export const SCRIPTS = ["abc", "αβγ", "абв", "अआइ", "あいう", "ابج"] as const;
const CELLS = 60;
const GAP = 0.4; // between cells, in cell sizes
const FLIGHT = 0.95;

type Curve3 = readonly [Pt, Pt, Pt];
type Curve4 = readonly [Pt, Pt, Pt, Pt];
export type Label = { x: number; y: number; anchor: "start" | "middle" | "end"; text: string };

export type CategoriesLayout = {
  width: number;
  height: number;
  font: number;
  cells: readonly { x: number; y: number }[];
  cellSize: number;
  lanes: readonly Curve4[];
  focus: Pt;
  pill: { w: number; h: number };
  labels: readonly Label[];
  /** Per token: its script (= lane). */
  scripts: readonly number[];
  /** Per cell: the flight from the embedding point to the cell centre. */
  flights: readonly Curve3[];
  /** Seconds per lap, the moment the stream starts at, pill travel time per lane, category order,
   *  and the length after which everything repeats exactly (categories rotate one step per lap). */
  stream: { period: number; start: number; travel: readonly number[]; order: readonly number[]; cycle: number };
};

export function quadAt([a, c, b]: Curve3, t: number): Pt {
  const u = 1 - t;
  return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]];
}

/** Path data of the part of a quadratic Bézier between t0 and t1 (blossoming). */
function quadPart([a, c, b]: Curve3, t0: number, t1: number) {
  const p0 = quadAt([a, c, b], t0);
  const p1 = quadAt([a, c, b], t1);
  const w0 = (1 - t0) * (1 - t1);
  const w1 = (1 - t0) * t1 + t0 * (1 - t1);
  const w2 = t0 * t1;
  const q: Pt = [w0 * a[0] + w1 * c[0] + w2 * b[0], w0 * a[1] + w1 * c[1] + w2 * b[1]];
  return `M${r1(p0[0])} ${r1(p0[1])}Q${r1(q[0])} ${r1(q[1])} ${r1(p1[0])} ${r1(p1[1])}`;
}

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

const cubicLength = (curve: Curve4) => {
  let length = 0;
  let prev = curve[0];
  for (let i = 1; i <= 24; i++) {
    const p = cubicAt(...curve, i / 24);
    length += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
    prev = p;
  }
  return length;
};

export function layoutCategories({ width, height }: Size, variant: Variant): CategoriesLayout {
  const hero = variant === "hero";
  const portrait = width / height < 0.85;
  const font = LABEL_SIZE;
  const pad = clamp(Math.min(width, height) * 0.075, 16, 44);
  const U = portrait ? height : width;
  const V = portrait ? width : height;
  const at = (u: number, v: number): Pt => (portrait ? [v, u] : [u, v]);

  // Grid: 10 × 6 or 6 × 10, whichever gives bigger cells (a wide frame breaks ties for the wide
  // grid). Capped, so cells never balloon into empty tiles on a big frame.
  const header = font + 16;
  const boxU = (U - pad * 2) * (portrait ? 0.5 : 0.44);
  const boxV = V - pad * 2 - (portrait ? 0 : header);
  const fit = (along: number, across: number) =>
    Math.min(34, boxU / (along + (along - 1) * GAP), boxV / (across + (across - 1) * GAP));
  const wideBias = U > V * 1.4 ? 1.12 : 1;
  const [along, across] = fit(6, 10) > fit(10, 6) * wideBias ? [6, 10] : [10, 6];
  const size = fit(along, across);
  const step = size * (1 + GAP);
  const spanU = along * step - GAP * size;
  const spanV = across * step - GAP * size;
  const v0 = pad + (portrait ? 0 : header);
  const vc = (v0 + V - pad) / 2;
  const gridU = U - pad - spanU;
  const gridV = vc - spanV / 2;

  const centre = (i: number): Pt => at(gridU + (i % along) * step + size / 2, gridV + Math.floor(i / along) * step + size / 2);
  const cells = Array.from({ length: CELLS }, (_, i) => {
    const [x, y] = centre(i);
    return { x: x - size / 2, y: y - size / 2 };
  });

  // Lanes converge on the embedding point, a short hop before the grid.
  const fu = gridU - clamp((U - pad * 2) * 0.11, 30, 90);
  const focus = at(fu, vc);
  const pillH = clamp(font + 7, 16, 19);
  const pill = { w: Math.round(pillH * (portrait ? 2.4 : 2.75)), h: pillH };
  const laneSpan = (V - pad * 2) * 0.82;
  const u0 = pad + (portrait ? pillH / 2 : pill.w / 2);
  const lanes = SCRIPTS.map((_, j): Curve4 => {
    const v = vc + (j - (SCRIPTS.length - 1) / 2) * (laneSpan / (SCRIPTS.length - 1));
    return [at(u0, v), at(u0 + (fu - u0) * 0.5, v), at(fu - (fu - u0) * 0.32, vc), focus];
  });
  const flights = Array.from({ length: CELLS }, (_, i): Curve3 => {
    const target = centre(i);
    const [tu, tv] = portrait ? [target[1], target[0]] : target;
    return [focus, at(fu + (tu - fu) * 0.45, vc + (tv - vc) * 0.1), target];
  });

  const labels: Label[] = [];
  const [gx, gy] = portrait ? [gridV + spanV, gridU] : [U - pad, gridV];
  labels.push({ x: gx, y: gy - 12, anchor: "end", text: "60 CATEGORIES" });
  if (portrait) {
    labels.push({ x: focus[0] + 16, y: focus[1] + font * 0.36, anchor: "start", text: hero ? "XLM EMBEDDING" : "EMBED" });
  } else {
    // Centred under the embedding point, but never reaching into the grid.
    const room = (gridU - 10 - focus[0]) * 2;
    const text = hero && textWidth("XLM EMBEDDING", font) <= room ? "XLM EMBEDDING" : "EMBED";
    const x = Math.min(focus[0], gridU - 10 - textWidth(text, font) / 2);
    labels.push({ x, y: focus[1] + 20 + font * 0.75, anchor: "middle", text });
  }
  if (hero && !portrait && width >= 520) labels.push({ x: pad, y: pad + font * 0.75, anchor: "start", text: "MULTILINGUAL URLS" });

  // Stream schedule: tokens launch on evenly spaced phases, scripts in a fixed rotation (so the
  // same lane is never reused within six launches), each lap landing in the next category.
  const rand = seeded(hero ? 23 : 5);
  const perm = shuffle([0, 1, 2, 3, 4, 5], rand);
  const count = hero ? 24 : 18;
  const scripts = Array.from({ length: count }, (_, j) => perm[j % SCRIPTS.length]);
  const speed = clamp(width * 0.12, 60, 150);
  const travel = lanes.map((lane) => clamp(cubicLength(lane) / speed, 2, 4.2));
  const spacing = hero ? 0.6 : 0.7;
  const period = Math.max(count * spacing, Math.max(...travel) + FLIGHT + 1.5);
  const order = shuffle(
    Array.from({ length: CELLS }, (_, i) => i),
    rand,
  );
  const base: CategoriesLayout = {
    width,
    height,
    font,
    cells,
    cellSize: size,
    lanes,
    focus,
    pill,
    labels,
    scripts,
    flights,
    stream: { period, start: 0, travel, order, cycle: period * (CELLS / gcd(count, CELLS)) },
  };

  // Start (and settle) at a moment with a token in flight to the grid and plenty on the lanes.
  let start = 0;
  let best = -1;
  for (let k = 0; k < 48; k++) {
    const t = (k / 48) * period;
    const frame = streamFrame({ ...base, stream: { ...base.stream, start: t } }, 0);
    const score = frame.pills.filter((p) => p.opacity > 0.6).length + (frame.dots.some((d) => d.opacity > 0.9) ? 4 : 0);
    if (score > best) {
      best = score;
      start = t;
    }
  }
  return { ...base, stream: { ...base.stream, start } };
}

/* ------------------------------------------------------------------------------------------
   The stream as a pure function of time: the animation renders it every frame, the settled
   (reduced-motion) frame is simply t = 0.
   ------------------------------------------------------------------------------------------ */

export type StreamFrame = {
  pills: { x: number; y: number; scale: number; opacity: number }[];
  dots: { x: number; y: number; opacity: number; streak: string }[];
  /** Accent fill opacity per cell. */
  glow: number[];
  /** Embedding point response, 0–1. */
  pulse: number;
};

const PEAK = 0.9;
const RESIDUE = 0.2;

/** A landing flashes, settles to a residue and fades out over about half a lap. */
function glowAt(age: number, tau: number) {
  if (age < 0) return 0;
  if (age < 0.14) return (age / 0.14) * PEAK;
  if (age < 1.4) return RESIDUE + (PEAK - RESIDUE) * (1 - (age - 0.14) / 1.26) ** 2;
  const g = RESIDUE * Math.exp(-(age - 1.4) / tau);
  return g < 0.02 ? 0 : g;
}

const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);

export function streamFrame(layout: CategoriesLayout, t: number): StreamFrame {
  const { lanes, flights, scripts, stream } = layout;
  const { period, start, travel, order } = stream;
  const T = t + start;
  const n = scripts.length;
  const cellOf = (j: number, lap: number) => order[(((j + lap * n) % CELLS) + CELLS) % CELLS];
  const glow = new Array<number>(CELLS).fill(0);
  let pulse = 0;

  const pills: StreamFrame["pills"] = [];
  const dots: StreamFrame["dots"] = [];
  scripts.forEach((script, j) => {
    const since = T - (j * period) / n;
    const lap = Math.floor(since / period);
    const local = since - lap * period;
    const tr = travel[script];
    const land = tr + FLIGHT - 0.06;

    // Pill: accelerates along its lane, shrinking into the embedding point.
    const x = local / tr;
    if (x < 1) {
      const p = x * x;
      const [px, py] = cubicAt(...lanes[script], p);
      const opacity = p < 0.08 ? p / 0.08 : p > 0.84 ? (1 - p) / 0.16 : 1;
      pills.push({ x: px, y: py, scale: p < 0.7 ? 1 : 1 - ((p - 0.7) / 0.3) * 0.78, opacity });
    } else pills.push({ x: 0, y: 0, scale: 1, opacity: 0 });

    // Dot: hops from the embedding point to this lap's category.
    const f = (local - (tr - 0.05)) / FLIGHT;
    if (f >= 0 && local < land + 0.18) {
      const curve = flights[cellOf(j, lap)];
      const e = easeInOut(Math.min(f, 1));
      const [dx, dy] = quadAt(curve, e);
      const opacity = Math.min(1, (f * FLIGHT) / 0.12, local > land ? 1 - (local - land) / 0.18 : 1);
      dots.push({ x: dx, y: dy, opacity, streak: e > 0.02 ? quadPart(curve, Math.max(0, e - 0.22), e) : "" });
    } else dots.push({ x: 0, y: 0, opacity: 0, streak: "" });

    const arrive = local - tr + 0.1;
    if (arrive > 0 && arrive < 0.6) pulse = Math.max(pulse, Math.sin((Math.PI * arrive) / 0.6));

    // Glow left by this token's last few landings (older laps landed in other categories).
    const latest = Math.floor((since - land) / period);
    for (let k = latest - 1; k <= latest; k++) {
      const cell = cellOf(j, k);
      glow[cell] = Math.max(glow[cell], glowAt(since - land - k * period, period * 0.35));
    }
  });
  return { pills, dots, glow, pulse };
}

export const laneD = (lane: Curve4) => cubicD(...lane);
