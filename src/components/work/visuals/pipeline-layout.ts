import { clamp, cubicAt, cubicD, LABEL_SIZE, r1, textWidth, type Pt, type Size, type Variant } from "./shared";

/** The seven real stages, in order, and the six label sources — from the résumé. */
export const STAGES = ["INVENTORY", "LABELING", "EXTRACTION", "SAMPLING", "HP TUNING", "TRAINING", "EVALUATION"] as const;
export const SOURCES = ["VIRUSTOTAL", "REVERSINGLABS", "AVTEST", "DOD", "ENDPOINT FEEDBACK", "ANALYSTS"] as const;

export const NODE_R = 5;
/** Stage the settled (reduced-motion) frame shows the run at. */
export const STILL_STAGE = 4;

export type Label = {
  x: number;
  y: number;
  anchor: "start" | "middle" | "end";
  text: string;
  /** Inline index before the text ("01 INVENTORY"). */
  ordinal?: string;
  subtle?: boolean;
  rotate?: number;
};
export type Stage = { x: number; y: number; labels: readonly Label[] };
export type Feed = { x: number; y: number; label: Label; d: string };
export type LoopBack = { d: string; arrow: string; label: Label };

export type PipelineLayout = {
  width: number;
  height: number;
  font: number;
  stages: readonly Stage[];
  /** Stage i → i+1, centre to centre (a mask hides them inside the nodes). */
  links: readonly string[];
  /** Every link as one path: the run's progress line draws along it. */
  run: string;
  /** The run up to STILL_STAGE, for the settled frame. */
  stillRun: string;
  loop: LoopBack | null;
  feeds: readonly Feed[];
};

const ordinal = (i: number) => `0${i + 1}`;
const pt = ([x, y]: Pt) => `${r1(x)} ${r1(y)}`;
/** Links share endpoints, so they join into one path by dropping every leading move but the first. */
const join = (links: readonly string[]) => links.map((d, i) => (i ? d.replace(/^M[^A-Za-z]*/, "") : d)).join("");

function finish(base: Omit<PipelineLayout, "run" | "stillRun">): PipelineLayout {
  return { ...base, run: join(base.links), stillRun: join(base.links.slice(0, STILL_STAGE)) };
}

export function layoutPipeline(size: Size, variant: Variant): PipelineLayout {
  const aspect = size.width / size.height;
  if (aspect >= 1.5) return horizontal(size, variant);
  return (aspect >= 0.95 && serpentineRows(size, variant)) || serpentineColumns(size, variant);
}

/** Wide frames, one row in a gentle zigzag: inventory, extraction, HP tuning and evaluation sit low. */
function horizontal({ width, height }: Size, variant: Variant): PipelineLayout {
  const hero = variant === "hero";
  const font = LABEL_SIZE;
  const pad = clamp(Math.min(width, height) * 0.08, 16, 48);
  const names = STAGES.map((s) => textWidth(s, font));
  const withFeeds = hero && width >= 720;
  const lineH = font + 6;
  const labelGap = NODE_R + 10;

  let left = pad + names[0] / 2;
  const right = width - pad - names[6] / 2;
  const feedX = withFeeds ? pad + Math.max(...SOURCES.map((s) => textWidth(s, font))) + 12 : 0;
  if (withFeeds) left = Math.max(left, feedX + clamp(width * 0.05, 40, 96) + names[0] / 2);
  const step = (right - left) / 6;

  // Vertical budget, relative to the row centre. Try the roomy version first, then tighten.
  const budget = height - pad * 2;
  const plan = (ordinals: boolean, amp: number, feedStep: number, feedGap: number) => {
    const block = (ordinals ? 2 : 1) * lineH - 6;
    const upTop = -amp - labelGap - block;
    const downBottom = amp + labelGap + block;
    const loopY = upTop - 18;
    const top = hero ? loopY - 10 - font : upTop;
    const feedTop = amp + NODE_R + feedGap;
    const bottom = withFeeds ? Math.max(downBottom, feedTop + feedStep * 5 + font * 0.4) : downBottom;
    return { ordinals, amp, feedStep, feedTop, loopY, top, bottom, fits: bottom - top <= budget };
  };
  const roomyAmp = clamp(Math.min(height * 0.11, step * 0.55), 8, 60);
  const p =
    [
      plan(width >= 420, roomyAmp, clamp(height * 0.055, 18, 34), clamp(height * 0.08, 28, 64)),
      plan(width >= 420, Math.min(roomyAmp, 12), 17, 22),
    ].find((option) => option.fits) ?? plan(false, 8, 16, 18);
  const cy = (height - (p.bottom - p.top)) / 2 - p.top;

  const stages = STAGES.map((text, i): Stage => {
    const low = i % 2 === 0;
    const x = left + step * i;
    const y = cy + (low ? p.amp : -p.amp);
    const labels: Label[] = [];
    if (i === 0 && withFeeds) {
      // Entry point: label on the left, leaving the space below for the feeds.
      const lx = x - NODE_R - 12;
      const ly = y + font * 0.36 + (p.ordinals ? lineH / 2 : 0);
      if (p.ordinals) labels.push({ x: lx, y: ly - lineH, anchor: "end", text: ordinal(i), subtle: true });
      labels.push({ x: lx, y: ly, anchor: "end", text });
    } else if (low) {
      let ly = y + labelGap + font * 0.74;
      if (p.ordinals) {
        labels.push({ x, y: ly, anchor: "middle", text: ordinal(i), subtle: true });
        ly += lineH;
      }
      labels.push({ x, y: ly, anchor: "middle", text });
    } else {
      labels.push({ x, y: y - labelGap, anchor: "middle", text });
      if (p.ordinals) labels.push({ x, y: y - labelGap - lineH, anchor: "middle", text: ordinal(i), subtle: true });
    }
    return { x, y, labels };
  });

  const links = stages.slice(1).map((b, i) => {
    const a = stages[i];
    const k = (b.x - a.x) * 0.5;
    return cubicD([a.x, a.y], [a.x + k, a.y], [b.x - k, b.y], [b.x, b.y]);
  });

  let loop: LoopBack | null = null;
  if (hero) {
    // Π-shaped feedback loop: up out of evaluation, across the top, down into inventory.
    const first = stages[0];
    const last = stages[6];
    const ly = cy + p.loopY;
    const rad = clamp(step * 0.3, 8, 18);
    const tip = first.y - NODE_R - 5;
    loop = {
      d: `M${pt([last.x, last.y])}L${pt([last.x, ly + rad])}Q${pt([last.x, ly])} ${pt([last.x - rad, ly])}L${pt([first.x + rad, ly])}Q${pt([first.x, ly])} ${pt([first.x, ly + rad])}L${pt([first.x, first.y])}`,
      arrow: `M${pt([first.x - 3.5, tip - 5])}L${pt([first.x, tip])}L${pt([first.x + 3.5, tip - 5])}`,
      label: { x: (first.x + last.x) / 2, y: ly - 9, anchor: "middle", text: "DAILY RETRAIN" },
    };
  }

  // Six label feeds rise into "labeling" from below, converging on one point. Each curve passes
  // under the inventory node before sweeping up (the loosest bend that clears it wins).
  const target = stages[1];
  const clearX = stages[0].x + NODE_R + 10;
  const clearY = stages[0].y + NODE_R + 8;
  const feeds = withFeeds
    ? SOURCES.map((text, j): Feed => {
        const y = cy + p.feedTop + j * p.feedStep;
        const curve = (a: number, b: number) =>
          [[feedX, y], [feedX + (target.x - feedX) * a, y], [target.x, target.y + (y - target.y) * b], [target.x, target.y]] as const;
        const clears = (c: ReturnType<typeof curve>) =>
          Array.from({ length: 48 }, (_, i) => cubicAt(...c, i / 47)).every(([x, cyy]) => x > clearX || cyy > clearY + 4);
        const options = [curve(0.62, 0.55), curve(0.75, 0.62), curve(0.86, 0.7), curve(0.94, 0.78)];
        const d = cubicD(...(options.find(clears) ?? options[options.length - 1]));
        return { x: feedX, y, d, label: { x: feedX - 10, y: y + font * 0.36, anchor: "end", text } };
      })
    : [];

  return finish({ width, height, font, stages, links, loop, feeds });
}

/** Steps along the serpentine: four out, three back at wider spacing, so both runs span the same width
 *  and evaluation lands right under inventory (where the hero's retrain loop closes the circuit). */
const SERPENTINE = [0, 1, 2, 3, 3, 1.5, 0] as const;
/** The U-turn's radius never exceeds this share of a step: it reads as a bend, not a loop of its own. */
const TURN = 0.8;
/** Card frames stretch the U-turn into a half-ellipse so the circuit spans this share of the height. */
const CARD_SPAN = 0.8;
/** …without the turn growing taller than this multiple of its width. */
const MAX_STRETCH = 1.8;
/** Minimum air between neighbouring stage labels. */
const LABEL_AIR = 16;

/**
 * Square-ish frames: left to right along the top, a U-turn, right to left along the bottom. The
 * hero's retrain loop closes the left side, turning the pipeline into one continuous circuit.
 * Null when four labels don't fit side by side (small frames use the column version).
 */
function serpentineRows({ width, height }: Size, variant: Variant): PipelineLayout | null {
  const hero = variant === "hero";
  const font = LABEL_SIZE;
  const pad = clamp(Math.min(width, height) * 0.08, 16, 48);
  const names = STAGES.map((s) => textWidth(s, font));
  const lineH = font + 6;
  const gap = NODE_R + 10;
  const band = 2 * lineH - 6 + gap; // ordinal + name, above the top run and below the bottom one

  const edge = Math.max(names[0], names[6]) / 2;
  const free = width - pad * 2 - (hero ? 0 : edge);
  const R = clamp(Math.min((height - pad * 2 - band * 2) * 0.36, (TURN * free) / (3 + (hero ? 2 : 1) * TURN)), 18, 190);
  const x0 = pad + Math.max(edge, hero ? R + 2 : 0);
  const x3 = width - pad - Math.max(names[3] / 2, names[4] / 2, R + 2);
  const step = (x3 - x0) / 3;
  if ([0, 1, 2].some((i) => step < (names[i] + names[i + 1]) / 2 + LABEL_AIR)) return null;
  // Half the distance between the runs: the U-turn's vertical radius.
  const V = hero ? R : clamp((height * CARD_SPAN - band * 2) / 2, R, R * MAX_STRETCH);
  const y1 = height / 2 - V;
  const y2 = height / 2 + V;

  const stages = STAGES.map((text, i): Stage => {
    const x = x0 + SERPENTINE[i] * step;
    if (i < 4) {
      return {
        x,
        y: y1,
        labels: [
          { x, y: y1 - gap - lineH, anchor: "middle", text: ordinal(i), subtle: true },
          { x, y: y1 - gap, anchor: "middle", text },
        ],
      };
    }
    const ly = y2 + gap + font * 0.74;
    return {
      x,
      y: y2,
      labels: [
        { x, y: ly, anchor: "middle", text: ordinal(i), subtle: true },
        { x, y: ly + lineH, anchor: "middle", text },
      ],
    };
  });

  const links = stages.slice(1).map((b, i) => {
    const a = stages[i];
    // Clockwise half turn down the right side into stage 5.
    if (i === 3) return `M${pt([a.x, a.y])}A${r1(R)} ${r1(V)} 0 0 1 ${pt([b.x, b.y])}`;
    return `M${pt([a.x, a.y])}L${pt([b.x, b.y])}`;
  });

  let loop: LoopBack | null = null;
  if (hero) {
    const first = stages[0];
    const last = stages[6];
    const tip = first.x - NODE_R - 5;
    loop = {
      d: `M${pt([last.x, last.y])}A${r1(R)} ${r1(R)} 0 0 1 ${pt([first.x, first.y])}`,
      arrow: `M${pt([tip - 5, first.y - 3.5])}L${pt([tip, first.y])}L${pt([tip - 5, first.y + 3.5])}`,
      // Inside the circuit, against the bend it names.
      label: { x: first.x - R + 12, y: height / 2 + font * 0.36, anchor: "start", text: "DAILY RETRAIN" },
    };
  }

  return finish({ width, height, font, stages, links, loop, feeds: [] });
}

/** Portrait frames: the serpentine on its side — down the left column, a U-turn, up the right. */
function serpentineColumns({ width, height }: Size, variant: Variant): PipelineLayout {
  const hero = variant === "hero";
  const font = LABEL_SIZE;
  const pad = clamp(Math.min(width, height) * 0.08, 16, 44);
  const gap = NODE_R + 12;
  const ordW = textWidth("00", font) + font * 0.8;
  const leftW = gap + ordW + Math.max(...STAGES.slice(0, 4).map((s) => textWidth(s, font)));
  const rightW = gap + ordW + Math.max(...STAGES.slice(4).map((s) => textWidth(s, font)));

  const top = pad + (hero ? font + 10 : font * 0.6);
  const byWidth = (width - pad * 2 - leftW - rightW) / 2;
  const byHeight = (TURN * (height - pad - top)) / (3 + (hero ? 2 : 1) * TURN);
  const R = clamp(Math.min(byWidth, byHeight), 16, 150);
  const y0 = top + (hero ? R : 0);
  const step = (height - pad - R - y0) / 3;
  const c1 = (width - (leftW + 2 * R + rightW)) / 2 + leftW;
  const c2 = c1 + 2 * R;

  const stages = STAGES.map((text, i): Stage => {
    const left = i < 4;
    const x = left ? c1 : c2;
    const y = y0 + SERPENTINE[i] * step;
    const label: Label = { x: left ? x - gap : x + gap, y: y + font * 0.36, anchor: left ? "end" : "start", text, ordinal: ordinal(i) };
    return { x, y, labels: [label] };
  });

  const links = stages.slice(1).map((b, i) => {
    const a = stages[i];
    // Counter-clockwise half turn under the left column into stage 5.
    if (i === 3) return `M${pt([a.x, a.y])}A${r1(R)} ${r1(R)} 0 0 0 ${pt([b.x, b.y])}`;
    return `M${pt([a.x, a.y])}L${pt([b.x, b.y])}`;
  });

  let loop: LoopBack | null = null;
  if (hero) {
    const first = stages[0];
    const last = stages[6];
    const tip = first.y - NODE_R - 5;
    loop = {
      d: `M${pt([last.x, last.y])}A${r1(R)} ${r1(R)} 0 0 0 ${pt([first.x, first.y])}`,
      arrow: `M${pt([first.x - 3.5, tip - 5])}L${pt([first.x, tip])}L${pt([first.x + 3.5, tip - 5])}`,
      label: { x: (c1 + c2) / 2, y: y0 - R - 9, anchor: "middle", text: "DAILY RETRAIN" },
    };
  }

  return finish({ width, height, font, stages, links, loop, feeds: [] });
}
