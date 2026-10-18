import { clamp, closedCurveD, gaussian, LABEL_SIZE, r1, seeded, textWidth, type Pt, type Size, type Variant } from "./shared";

/**
 * "Embedding space": behavioural embeddings form loose classes; one (accent) is the class the
 * model separates out. Cluster centres are normalised to the padded frame; spreads are in units
 * of its shorter side so clusters stay round at any aspect ratio.
 */
type ClusterSpec = { cx: number; cy: number; sx: number; sy: number; rot: number; share: number; tone: number };

const CLUSTERS: readonly ClusterSpec[] = [
  { cx: 0.62, cy: 0.46, sx: 0.06, sy: 0.042, rot: -0.55, share: 0.18, tone: 1 }, // accent
  { cx: 0.2, cy: 0.42, sx: 0.06, sy: 0.048, rot: 0.7, share: 0.15, tone: 0.9 },
  { cx: 0.38, cy: 0.78, sx: 0.07, sy: 0.04, rot: -0.15, share: 0.15, tone: 0.7 },
  { cx: 0.86, cy: 0.74, sx: 0.05, sy: 0.044, rot: 0.9, share: 0.12, tone: 0.8 },
  { cx: 0.87, cy: 0.2, sx: 0.045, sy: 0.036, rot: 0.3, share: 0.09, tone: 0.6 },
  { cx: 0.42, cy: 0.2, sx: 0.052, sy: 0.036, rot: 0.15, share: 0.1, tone: 0.75 },
  { cx: 0.1, cy: 0.83, sx: 0.04, sy: 0.036, rot: 0.4, share: 0.08, tone: 0.55 },
];

const NOISE_SHARE = 0.12;

type Seed = {
  cluster: number; // -1 = noise
  /** Offset from the cluster centre (spread units) or, for noise, a normalised position. */
  ox: number;
  oy: number;
  /** Normalised scattered start position. */
  su: number;
  sv: number;
  size: number;
  alpha: number;
};

function seedPoints(total: number, seed: number): readonly Seed[] {
  const rand = seeded(seed);
  const points: Seed[] = [];
  CLUSTERS.forEach((spec, cluster) => {
    const count = Math.round(total * spec.share);
    for (let i = 0; i < count; i++) {
      const gx = clamp(gaussian(rand), -2.3, 2.3) * spec.sx;
      const gy = clamp(gaussian(rand), -2.3, 2.3) * spec.sy;
      const cos = Math.cos(spec.rot);
      const sin = Math.sin(spec.rot);
      points.push({
        cluster,
        ox: gx * cos - gy * sin,
        oy: gx * sin + gy * cos,
        su: rand(),
        sv: rand(),
        size: 0.8 + rand() * 0.45,
        alpha: cluster === 0 ? 0.8 + rand() * 0.2 : spec.tone * (0.5 + rand() * 0.5),
      });
    }
  });
  const noise = Math.round(total * NOISE_SHARE);
  for (let i = 0; i < noise; i++) {
    const ox = 0.03 + rand() * 0.94;
    const oy = 0.03 + rand() * 0.94;
    // Keep the corner caption clear.
    if (ox < 0.3 && oy < 0.12) continue;
    points.push({ cluster: -1, ox, oy, su: ox, sv: oy, size: 0.7 + rand() * 0.3, alpha: 0.25 + rand() * 0.3 });
  }
  return points;
}

const SEEDS: Record<Variant, readonly Seed[]> = {
  card: seedPoints(226, 11),
  hero: seedPoints(276, 29),
};

export type ClusterDot = { x: number; y: number; r: number; alpha: number; sx: number; sy: number };
export type ClusterGroup = { cx: number; cy: number; dots: ClusterDot[] };

export type ClustersLayout = {
  width: number;
  height: number;
  pad: number;
  font: number;
  noise: readonly ClusterDot[];
  /** Index 0 is the accent class. */
  groups: readonly ClusterGroup[];
  boundary: string;
  margin: string;
  /** Leader from the boundary to its caption. */
  leader: string;
  /** Empty text when no side of the boundary has room. */
  caption: { x: number; y: number; anchor: "start" | "middle" | "end"; text: string };
  /** Faint dot lattice behind the space: tile size and offsets that centre it in the content box. */
  grid: { step: number; x: number; y: number; top: number };
  hero: boolean;
};

export function layoutClusters({ width, height }: Size, variant: Variant): ClustersLayout {
  const portrait = width / height < 0.85;
  const pad = clamp(Math.min(width, height) * 0.075, 16, 40);
  const font = LABEL_SIZE;
  // Leave a band for the corner caption.
  const top = pad + font + 10;
  const cw = width - pad * 2;
  const ch = height - top - pad;
  const unit = Math.min(cw, ch) * (portrait ? 1.05 : 1.12);
  const radius = clamp(unit / 210, 1.25, 2.1);

  const place = (u: number, v: number): Pt => (portrait ? [pad + v * cw, top + u * ch] : [pad + u * cw, top + v * ch]);

  const groups = CLUSTERS.map((spec) => {
    const [cx, cy] = place(spec.cx, spec.cy);
    return { cx, cy, dots: [] as ClusterDot[] };
  });
  const noise: ClusterDot[] = [];

  for (const seed of SEEDS[variant]) {
    const [sx, sy] = place(seed.su, seed.sv);
    if (seed.cluster < 0) {
      const [x, y] = place(seed.ox, seed.oy);
      noise.push({ x, y, r: radius * seed.size, alpha: seed.alpha, sx, sy });
      continue;
    }
    const group = groups[seed.cluster];
    const [ox, oy] = portrait ? [seed.oy, seed.ox] : [seed.ox, seed.oy];
    group.dots.push({ x: group.cx + ox * unit, y: group.cy + oy * unit, r: radius * seed.size, alpha: seed.alpha, sx, sy });
  }

  // Decision boundary: support radius of the accent class in 20 directions, padded and smoothed.
  // Directions start lower-left so the stroke sweeps around the class in one gesture.
  const accent = groups[0];
  const cx = accent.dots.reduce((sum, d) => sum + d.x, 0) / accent.dots.length;
  const cy = accent.dots.reduce((sum, d) => sum + d.y, 0) / accent.dots.length;
  const steps = 20;
  const start = Math.PI * 0.8;
  const angle = (k: number) => start + (k / steps) * Math.PI * 2;
  const gap = clamp(unit * 0.036, 8, 15);
  let radii = Array.from({ length: steps }, (_, k) => {
    const ux = Math.cos(angle(k));
    const uy = Math.sin(angle(k));
    return Math.max(...accent.dots.map((d) => (d.x - cx) * ux + (d.y - cy) * uy)) + gap;
  });
  for (let pass = 0; pass < 2; pass++) {
    radii = radii.map((r, k) => Math.max(r, (radii[(k + steps - 1) % steps] + 2 * r + radii[(k + 1) % steps]) / 4));
  }
  const ring = (extra: number) =>
    radii.map((r, k): Pt => [cx + Math.cos(angle(k)) * (r + extra), cy + Math.sin(angle(k)) * (r + extra)]);
  const boundary = closedCurveD(ring(0));
  const margin = closedCurveD(ring(gap * 0.9));

  // Noise never sits inside the separated class: the boundary should read as clean separation.
  const outside = (d: ClusterDot) => {
    const a = Math.atan2(d.y - cy, d.x - cx);
    const k = Math.round(((((a - start) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / ((Math.PI * 2) / steps)) % steps;
    return Math.hypot(d.x - cx, d.y - cy) > radii[k] + gap * 1.6;
  };
  let clearNoise = noise.filter(outside);

  // Caption on the side of the boundary with the most open space around it.
  const captionText = "CLASS BOUNDARY";
  const tw = textWidth(captionText, font);
  const others = [...clearNoise, ...groups.slice(1).flatMap((g) => g.dots)];
  let best = {
    score: -Infinity,
    leader: "",
    caption: { x: 0, y: 0, anchor: "start" as "start" | "middle" | "end", text: "" },
  };
  // k -> angle 0.8π + k·0.1π (y down): 9-11 up-right, 13-15 down-right, 4-6 up-left, 18-1 down-left,
  // 7/17 straight up/down (used when the frame is too narrow for a side caption).
  for (const k of [9, 10, 11, 4, 5, 6, 13, 14, 15, 18, 19, 0, 7, 17]) {
    const a = angle(k);
    const r = radii[k] + 4;
    const bx = cx + Math.cos(a) * r;
    const by = cy + Math.sin(a) * r;
    const vertical = Math.abs(Math.cos(a)) < 0.2;
    const ex = bx + Math.cos(a) * (vertical ? 14 : 18);
    const ey = by + Math.sin(a) * (vertical ? 14 : 18);
    const dir = Math.cos(a) >= 0 ? 1 : -1;
    const up = Math.sin(a) < 0;
    const tx = vertical ? ex : ex + dir * 16;
    const ty = vertical ? (up ? ey - 8 : ey + font + 6) : ey + font * 0.36;
    const left = vertical ? tx - tw / 2 : dir > 0 ? tx : tx - tw;
    if (left < pad || left + tw > width - pad || ty - font < top || ty + 4 > height - pad) continue;
    const midX = left + tw / 2;
    const midY = ty - font * 0.36;
    const clearance = Math.min(...others.map((d) => Math.hypot((d.x - midX) / (tw / 2 + 10), (d.y - midY) / 16)));
    // Prefer side captions (they read as annotations), and captions above the class.
    const score = clearance + (ey < cy ? 0.2 : 0) - (vertical ? 0.6 : 0);
    if (score > best.score) {
      best = {
        score,
        leader: vertical
          ? `M${r1(bx)} ${r1(by)}L${r1(ex)} ${r1(ey)}`
          : `M${r1(bx)} ${r1(by)}L${r1(ex)} ${r1(ey)}L${r1(ex + dir * 10)} ${r1(ey)}`,
        caption: { x: tx, y: ty, anchor: vertical ? "middle" : dir > 0 ? "start" : "end", text: captionText },
      };
    }
  }

  // Points are decorative: clear any that would sit under the caption so it always reads cleanly.
  if (best.caption.text) {
    const { x, y, anchor } = best.caption;
    const left = anchor === "start" ? x : anchor === "end" ? x - tw : x - tw / 2;
    const free = (d: ClusterDot) => d.x < left - 6 || d.x > left + tw + 6 || d.y < y - font - 5 || d.y > y + 6;
    for (const group of groups.slice(1)) group.dots = group.dots.filter(free);
    clearNoise = clearNoise.filter(free);
  }

  const step = Math.round(clamp(unit / 11, 18, 36));
  const grid = { step, x: pad + ((cw % step) - step) / 2, y: top + ((ch % step) - step) / 2, top };

  return {
    width,
    height,
    pad,
    font,
    noise: clearNoise,
    groups,
    boundary,
    margin,
    leader: best.leader,
    caption: best.caption,
    grid,
    hero: variant === "hero",
  };
}
