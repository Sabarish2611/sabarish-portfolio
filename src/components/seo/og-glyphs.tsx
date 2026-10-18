import type { CSSProperties, JSX } from "react";
import type { ProjectVisual } from "@/content/projects";
import { buildConstellation, Constellation, OG } from "./og";

/**
 * Small diagram per case study for the social cards — grey structure, exactly one accent element
 * (the "signal"). Counts that appear here are facts from projects.ts (7 stages, 60 categories);
 * the rest is illustrative. Satori: flexbox + absolute positioning only.
 */
const W = 176;
const H = 150;
const ink = (alpha: number) => `rgba(237, 234, 228, ${alpha})`;
const glow = "0 0 14px rgba(198, 244, 50, 0.6)";

const frame: CSSProperties = { position: "relative", width: W, height: H, display: "flex", flexShrink: 0 };

const circle = (size: number): CSSProperties => ({ width: size, height: size, borderRadius: size, display: "flex" });

/** EDR: behaviour embeddings resolving into classes; one class is the threat. */
const clusterField = buildConstellation({
  seed: 353,
  clusters: [
    { x: 40, y: 46, spreadX: 14, spreadY: 11, count: 10 },
    { x: 122, y: 30, spreadX: 12, spreadY: 9, count: 8 },
    { x: 62, y: 118, spreadX: 14, spreadY: 9, count: 9 },
    { x: 132, y: 102, spreadX: 12, spreadY: 11, count: 12, signal: true },
  ],
  noise: 8,
  anomalies: [],
  bounds: { x: 4, y: 6, width: W - 8, height: H - 12 },
});

function Clusters() {
  return (
    <div style={frame}>
      <Constellation field={clusterField} />
    </div>
  );
}

/** MLOps: seven stages in a row, closed by the daily retrain loop. */
function Pipeline() {
  const stages = 7;
  const size = 13;
  const gap = (W - size) / (stages - 1);
  const y = 50;
  return (
    <div style={frame}>
      <div style={{ position: "absolute", left: size / 2, top: y, width: W - size, height: 1, backgroundColor: ink(0.4), display: "flex" }} />
      {/* The retrain loop: from the last stage back to the first. */}
      <div
        style={{
          position: "absolute",
          left: size / 2,
          top: y,
          width: W - size,
          height: 58,
          border: `1px dashed ${ink(0.34)}`,
          borderTop: "none",
          borderRadius: "0 0 29px 29px",
          display: "flex",
        }}
      />
      {Array.from({ length: stages }, (_, i) =>
        i === stages - 1 ? (
          <div key={i} style={{ ...circle(size), position: "absolute", left: i * gap, top: y - size / 2, backgroundColor: OG.accent, boxShadow: glow }} />
        ) : (
          <div
            key={i}
            style={{
              ...circle(size),
              position: "absolute",
              left: i * gap,
              top: y - size / 2,
              backgroundColor: OG.bg,
              border: `1.5px solid ${ink(0.7)}`,
            }}
          />
        ),
      )}
    </div>
  );
}

/** Autoencoder: layers narrow to a single latent unit and widen back out. */
function Autoencoder() {
  const layers = [7, 5, 3, 1, 3, 5, 7];
  return (
    <div style={{ ...frame, alignItems: "center", justifyContent: "space-between" }}>
      {layers.map((count, i) => (
        <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 13 }}>
          {Array.from({ length: count }, (_, j) =>
            count === 1 ? (
              <div key={j} style={{ ...circle(11), backgroundColor: OG.accent, boxShadow: glow }} />
            ) : (
              // Brighter towards the bottleneck.
              <div key={j} style={{ ...circle(7), backgroundColor: ink(0.2 + (1 - Math.abs(i - 3) / 3) * 0.35) }} />
            ),
          )}
        </div>
      ))}
    </div>
  );
}

/** URL categorization: 60 categories, one predicted. */
function Categories() {
  const cols = 10;
  const rows = 6;
  const cell = 9;
  const picked = 27;
  return (
    <div style={{ ...frame, alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", flexWrap: "wrap", width: cols * cell + (cols - 1) * 8, gap: 8 }}>
        {Array.from({ length: cols * rows }, (_, i) => (
          <div
            key={i}
            style={{
              width: cell,
              height: cell,
              borderRadius: 2,
              display: "flex",
              backgroundColor: i === picked ? OG.accent : ink(0.14 + ((i * 7) % 5) * 0.06),
              ...(i === picked ? { boxShadow: glow } : null),
            }}
          />
        ))}
      </div>
    </div>
  );
}

const GLYPHS: Record<ProjectVisual, () => JSX.Element> = {
  clusters: Clusters,
  pipeline: Pipeline,
  autoencoder: Autoencoder,
  categories: Categories,
};

export function ProjectGlyph({ visual }: { visual: ProjectVisual }) {
  const Glyph = GLYPHS[visual];
  return <Glyph />;
}
