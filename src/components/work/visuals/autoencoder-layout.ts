import {
  clamp,
  LABEL_SIZE,
  makeRoute,
  pointOnRoute,
  r1,
  routeD,
  seeded,
  shuffle,
  textWidth,
  type Pt,
  type Route,
  type Size,
  type Variant,
} from "./shared";

/**
 * Hourglass autoencoder. Alerts stream in, squeeze through the latent bottleneck and are
 * reconstructed on the other side. Most come out on the lane they went in on (reconstructed
 * well → low priority); the few the model can't reconstruct come out shifted, flagged in accent.
 * Laid out in flow coordinates (u along the stream, v across) so portrait frames just turn it.
 */
const LAYERS = [9, 6, 3, 6, 9] as const;
/** Seconds a flagged alert stays docked at the end of its lane. */
export const HOLD = 3.4;

type TokenSeed = { lane: number; h1: number; latent: number; h2: number; out: number; hot: boolean };

function seedTokens(count: number, seed: number): readonly TokenSeed[] {
  const rand = seeded(seed);
  const pick = (from: number, fromSize: number, toSize: number) =>
    clamp(Math.round((from / (fromSize - 1)) * (toSize - 1) + (rand() - 0.5) * 2.2), 0, toSize - 1);
  // Lanes cycle through a shuffled order so the stream never bunches on one wire.
  const lanes = shuffle(Array.from({ length: LAYERS[0] }, (_, i) => i), rand);
  return Array.from({ length: count }, (_, i) => {
    const lane = lanes[i % lanes.length];
    const h1 = pick(lane, 9, 6);
    const latent = pick(h1, 6, 3);
    const h2 = pick(latent, 3, 6);
    const hot = i % 4 === 1;
    const out = hot ? clamp(lane + (lane > 4 ? -2 : 2), 0, 8) : lane;
    return { lane, h1, latent, h2, out, hot };
  });
}

const TOKENS: Record<Variant, readonly TokenSeed[]> = { card: seedTokens(12, 7), hero: seedTokens(16, 41) };

export type AutoencoderToken = {
  route: Route;
  /** Index of the latent node it passes through. */
  latent: number;
  hot: boolean;
  /** Distance along the route at which it reaches the output layer. */
  outAt: number;
  /** Polyline path data of the whole route and of its output lane (the flagged trace). */
  d: string;
  flagD: string;
  /** Length of the output lane (the flagged trace). */
  flagLength: number;
  /** Seconds since this alert's launch when the stream starts — the moment the settled frame shows. */
  local0: number;
  /** The settled frame: position, whether the alert is on screen, flagged, and how much trace is drawn. */
  still: { at: Pt; visible: boolean; flagged: boolean; drawn: number };
};
export type AeLabel = { x: number; y: number; anchor: "start" | "middle" | "end"; text: string };

export type AutoencoderLayout = {
  width: number;
  height: number;
  font: number;
  portrait: boolean;
  nodes: readonly (readonly Pt[])[];
  nodeR: number;
  /** One path per layer pair: every edge of a fully connected step. */
  edges: readonly string[];
  lanesIn: string;
  lanesOut: string;
  tokens: readonly AutoencoderToken[];
  labels: readonly AeLabel[];
  legend: Pt | null;
  /** Latent ring radius (kept clear of its neighbours). */
  ringR: number;
  /** Stream: travel speed (px/s) and the period every alert relaunches on. */
  speed: number;
  period: number;
};

export function layoutAutoencoder({ width, height }: Size, variant: Variant): AutoencoderLayout {
  const hero = variant === "hero";
  const portrait = width / height < 0.9;
  const font = LABEL_SIZE;
  const pad = clamp(Math.min(width, height) * 0.075, 16, 44);
  const U = portrait ? height : width;
  const V = portrait ? width : height;
  // (u, v) → (x, y)
  const at = (u: number, v: number): Pt => (portrait ? [v, u] : [u, v]);

  // Layer captions hug the network: above it (landscape) or to its left (portrait). Captions +
  // network form one block, centred across the flow.
  const gap = 18;
  const header = portrait ? textWidth("DECODE", font) + gap : font + gap;
  const u0 = pad;
  const u1 = U - pad;
  const lane = (u1 - u0) * (hero ? 0.2 : 0.17);
  const n0 = u0 + lane;
  const n1 = u1 - lane;
  const layerU = LAYERS.map((_, i) => n0 + ((n1 - n0) * i) / (LAYERS.length - 1));
  const dv = clamp(((V - pad * 2 - header) * 0.88) / 8, 9, 54);
  const netV0 = (V - header - 8 * dv) / 2 + header;
  const vc = netV0 + 4 * dv;
  const nodeR = clamp(dv * 0.13, 2.2, 3.8);

  const nodes = LAYERS.map((count, i) =>
    Array.from({ length: count }, (_, k): Pt => at(layerU[i], vc + (k - (count - 1) / 2) * dv)),
  );
  const seg = ([ax, ay]: Pt, [bx, by]: Pt) => `M${r1(ax)} ${r1(ay)}L${r1(bx)} ${r1(by)}`;
  const edges = nodes.slice(1).map((layer, i) => nodes[i].flatMap((a) => layer.map((b) => seg(a, b))).join(""));
  const clear = nodeR + 4;
  const lanesIn = nodes[0].map((p) => seg(at(u0, portrait ? p[0] : p[1]), at(n0 - clear, portrait ? p[0] : p[1]))).join("");
  const lanesOut = nodes[4].map((p) => seg(at(n1 + clear, portrait ? p[0] : p[1]), at(u1, portrait ? p[0] : p[1]))).join("");

  const paths = TOKENS[variant].map((t) => {
    const vIn = portrait ? nodes[0][t.lane][0] : nodes[0][t.lane][1];
    const vOut = portrait ? nodes[4][t.out][0] : nodes[4][t.out][1];
    const points: Pt[] = [at(u0, vIn), nodes[0][t.lane], nodes[1][t.h1], nodes[2][t.latent], nodes[3][t.h2], nodes[4][t.out], at(u1, vOut)];
    const route = makeRoute(points);
    return { t, points, route, outAt: route.cumulative[5] };
  });

  // The stream relaunches alerts on evenly spaced phases. It starts in its steady state, at a
  // moment with two flagged alerts on screen and as many as possible in flight; the settled
  // (reduced-motion) frame is that same moment.
  const speed = clamp(width * 0.17, 80, 190);
  const n = paths.length;
  const period = Math.max(n * 0.5, Math.max(...paths.map((p) => p.route.length)) / speed + HOLD + 1);
  const localAt = (T: number, j: number) => (((T - (j * period) / n) % period) + period) % period;
  const stateAt = (T: number, j: number) => {
    const { route, outAt, t } = paths[j];
    const local = localAt(T, j);
    const d = Math.min(local * speed, route.length);
    const visible = local < route.length / speed + (t.hot ? HOLD : 0);
    return { local, d, visible, flagged: t.hot && visible && d >= outAt };
  };
  let T0 = 0;
  let best = -1;
  for (let k = 0; k < 64; k++) {
    const T = (k / 64) * period;
    const states = paths.map((_, j) => stateAt(T, j));
    const score =
      Math.min(states.filter((s) => s.flagged).length, 2) * 100 + states.filter((s) => s.visible && !s.flagged).length;
    if (score > best) {
      best = score;
      T0 = T;
    }
  }

  const tokens = paths.map(({ t, points, route, outAt }, j): AutoencoderToken => {
    const { local, d, visible, flagged } = stateAt(T0, j);
    return {
      route,
      latent: t.latent,
      hot: t.hot,
      outAt,
      d: routeD(route),
      flagD: routeD(makeRoute([points[5], points[6]])),
      flagLength: route.length - outAt,
      local0: local,
      still: { at: pointOnRoute(route, d), visible, flagged, drawn: flagged ? d - outAt : 0 },
    };
  });

  const groupMid = (a: number, b: number) => (layerU[a] + layerU[b]) / 2;
  const captionAt = netV0 - gap;
  const caption = (u: number, text: string, anchor: AeLabel["anchor"] = "middle"): AeLabel =>
    portrait ? { x: captionAt, y: u + font * 0.36, anchor: "end", text } : { x: u, y: captionAt, anchor, text };
  const labels: AeLabel[] = [caption(groupMid(0, 1), "ENCODE"), caption(layerU[2], "LATENT"), caption(groupMid(3, 4), "DECODE")];
  let legend: Pt | null = null;
  if (hero && !portrait && lane >= textWidth("PRIORITIZED", font) + 18) {
    labels.unshift(caption(u0, "ALERTS", "start"));
    labels.push(caption(u1, "PRIORITIZED", "end"));
    // Accent ring key just left of the "PRIORITIZED" caption.
    legend = [u1 - textWidth("PRIORITIZED", font) - 12, captionAt - font * 0.37];
  }

  const ringR = Math.min(nodeR * 3, dv * 0.42);
  return { width, height, font, portrait, nodes, nodeR, edges, lanesIn, lanesOut, tokens, labels, legend, ringR, speed, period };
}
