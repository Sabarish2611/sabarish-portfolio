import type { CSSProperties } from "react";
import { mulberry32 } from "./prng";

/**
 * Building blocks for the generated social images and icons (next/og → Satori). Satori can't read
 * CSS variables, so this palette mirrors the dark-theme tokens in globals.css. Satori layout
 * rules: flexbox only, and every element with more than one child needs `display: flex`.
 */
export const OG = {
  bg: "#0b0b0c",
  fg: "#edeae4",
  muted: "#9a968e",
  subtle: "#6e6b65",
  line: "rgba(237, 234, 228, 0.14)",
  accent: "#c6f432",
  onAccent: "#0b0b0c",
} as const;

export const OG_SIZE = { width: 1200, height: 630 };

/** Family names registered with ImageResponse `fonts` — keep in sync with each route's font list. */
export const OG_FONT = {
  serif: "Instrument Serif",
  sans: "Geist",
  mono: "Geist Mono",
} as const;

/** The site's eyebrow: mono, uppercase, tracked. */
export const eyebrowStyle: CSSProperties = {
  fontFamily: OG_FONT.mono,
  fontSize: 20,
  letterSpacing: 2.2,
  textTransform: "uppercase",
  lineHeight: 1,
};

export type ClusterSpec = {
  x: number;
  y: number;
  spreadX: number;
  spreadY: number;
  count: number;
  /** The one class that lights up in the accent. */
  signal?: boolean;
};

export type Dot = { x: number; y: number; size: number; opacity: number; accent: boolean };

export type Box = { x: number; y: number; width: number; height: number };

/** Soft density cloud under a cluster — few points still read as a dense class. */
type Haze = { x: number; y: number; radiusX: number; radiusY: number; accent: boolean };

export type Field = { dots: Dot[]; hazes: Haze[]; signal: Box | null };

/**
 * Gaussian clusters plus uniform background noise and a few accent "anomalies". Also returns
 * each cluster's haze and the bounding box of the signal cluster (for the DetectionBox).
 */
export function buildConstellation({
  seed,
  clusters,
  noise,
  anomalies,
  bounds,
}: {
  seed: number;
  clusters: readonly ClusterSpec[];
  noise: number;
  /** Placed by hand (not seeded) so outliers never crowd the type. */
  anomalies: readonly { x: number; y: number }[];
  /** Area the noise is scattered over. */
  bounds: Box;
}): Field {
  const rand = mulberry32(seed);
  const gauss = () => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());
  const dots: Dot[] = [];
  const signalDots: Dot[] = [];

  for (const cluster of clusters) {
    for (let i = 0; i < cluster.count; i++) {
      const gx = Math.max(-2.2, Math.min(2.2, gauss()));
      const gy = Math.max(-2.2, Math.min(2.2, gauss()));
      // 1 at the core, 0 at the rim: cores read denser, brighter and larger.
      const core = 1 - Math.min(1, Math.hypot(gx, gy) / 2.4);
      const signal = Boolean(cluster.signal);
      const dot: Dot = {
        x: cluster.x + gx * cluster.spreadX,
        y: cluster.y + gy * cluster.spreadY,
        size: (signal ? 4 : 3) + core * 7 * (0.5 + rand() * 0.5),
        opacity: signal ? 0.6 + core * 0.4 : 0.32 + core * 0.6 * (0.6 + rand() * 0.4),
        accent: signal,
      };
      dots.push(dot);
      if (signal) signalDots.push(dot);
    }
  }

  for (let i = 0; i < noise; i++) {
    dots.push({
      x: bounds.x + rand() * bounds.width,
      y: bounds.y + rand() * bounds.height,
      size: 2.5 + rand() * 2.5,
      opacity: 0.16 + rand() * 0.24,
      accent: false,
    });
  }
  for (const point of anomalies) dots.push({ ...point, size: 5, opacity: 0.95, accent: true });

  const hazes = clusters.map((cluster) => ({
    x: cluster.x,
    y: cluster.y,
    radiusX: cluster.spreadX * (cluster.signal ? 6 : 3.6),
    radiusY: cluster.spreadY * (cluster.signal ? 7 : 3.6),
    accent: Boolean(cluster.signal),
  }));

  if (signalDots.length === 0) return { dots, hazes, signal: null };
  const xs = signalDots.map((dot) => dot.x);
  const ys = signalDots.map((dot) => dot.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { dots, hazes, signal: { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y } };
}

export function Constellation({ field }: { field: Field }) {
  return (
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex" }}>
      {field.hazes.map((haze, i) => (
        <div
          key={`haze-${i}`}
          style={{
            position: "absolute",
            left: haze.x - haze.radiusX,
            top: haze.y - haze.radiusY,
            width: haze.radiusX * 2,
            height: haze.radiusY * 2,
            display: "flex",
            backgroundImage: haze.accent
              ? "radial-gradient(ellipse at center, rgba(198, 244, 50, 0.15), rgba(198, 244, 50, 0) 70%)"
              : "radial-gradient(ellipse at center, rgba(237, 234, 228, 0.075), rgba(237, 234, 228, 0) 70%)",
          }}
        />
      ))}
      {field.dots.map((dot, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: dot.x - dot.size / 2,
            top: dot.y - dot.size / 2,
            width: dot.size,
            height: dot.size,
            borderRadius: dot.size,
            backgroundColor: dot.accent ? OG.accent : OG.fg,
            opacity: dot.opacity,
            // Accent points glow, like the additive blending in the hero shader. (Satori rejects
            // `boxShadow: undefined`, so the key is only present when used.)
            ...(dot.accent ? { boxShadow: `0 0 ${Math.round(dot.size * 1.6)}px rgba(198, 244, 50, 0.55)` } : null),
          }}
        />
      ))}
    </div>
  );
}

/** Object-detection style corner brackets + tag around a region (the "signal"). */
export function DetectionBox({ box, padding = 18, label }: { box: Box; padding?: number; label: string }) {
  const arm = 16;
  const stroke = `2px solid ${OG.accent}`;
  const corner = (style: CSSProperties) => (
    <div style={{ position: "absolute", width: arm, height: arm, display: "flex", ...style }} />
  );
  return (
    <div
      style={{
        position: "absolute",
        left: box.x - padding,
        top: box.y - padding,
        width: box.width + padding * 2,
        height: box.height + padding * 2,
        display: "flex",
      }}
    >
      {corner({ left: 0, top: 0, borderTop: stroke, borderLeft: stroke })}
      {corner({ right: 0, top: 0, borderTop: stroke, borderRight: stroke })}
      {corner({ left: 0, bottom: 0, borderBottom: stroke, borderLeft: stroke })}
      {corner({ right: 0, bottom: 0, borderBottom: stroke, borderRight: stroke })}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: -23,
          display: "flex",
          padding: "5px 8px 5px",
          backgroundColor: OG.accent,
          color: OG.onAccent,
          fontFamily: OG_FONT.mono,
          fontSize: 13,
          letterSpacing: 1.5,
          textTransform: "uppercase",
          lineHeight: 1,
        }}
      >
        {label}
      </div>
    </div>
  );
}
