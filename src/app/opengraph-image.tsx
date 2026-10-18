import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { buildConstellation, Constellation, DetectionBox, eyebrowStyle, OG, OG_FONT, OG_SIZE } from "@/components/seo/og";
import { site } from "@/content/site";

export const alt = `${site.name} — ${site.role}`;
export const size = OG_SIZE;
export const contentType = "image/png";

// Read once at module scope (request-independent), resolved from the project root.
const [serif, serifItalic, mono] = await Promise.all([
  readFile(join(process.cwd(), "src/assets/fonts/InstrumentSerif-Regular.ttf")),
  readFile(join(process.cwd(), "src/assets/fonts/InstrumentSerif-Italic.ttf")),
  readFile(join(process.cwd(), "src/assets/fonts/GeistMono-Regular.ttf")),
]);

// A still of the hero's latent space: grey classes, one accent class (the signal), a few anomalies.
const field = buildConstellation({
  seed: 20230701,
  clusters: [
    { x: 716, y: 160, spreadX: 30, spreadY: 20, count: 18 },
    { x: 900, y: 96, spreadX: 24, spreadY: 16, count: 14 },
    { x: 846, y: 266, spreadX: 28, spreadY: 15, count: 14 },
    { x: 1050, y: 204, spreadX: 24, spreadY: 20, count: 22, signal: true },
  ],
  noise: 16,
  anomalies: [
    { x: 1012, y: 92 },
    { x: 626, y: 236 },
    { x: 962, y: 318 },
  ],
  bounds: { x: 610, y: 40, width: 540, height: 290 },
});

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "60px 72px 54px",
          backgroundColor: OG.bg,
          color: OG.fg,
        }}
      >
        <Constellation field={field} />
        {field.signal ? <DetectionBox box={field.signal} label="Signal" /> : null}

        <div style={{ display: "flex", alignItems: "center", gap: 14, color: OG.muted, ...eyebrowStyle }}>
          <div style={{ width: 10, height: 10, borderRadius: 10, backgroundColor: OG.accent }} />
          {`${site.role} — ${site.company}`}
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontFamily: OG_FONT.serif,
              fontStyle: "italic",
              fontSize: 58,
              lineHeight: 1,
              letterSpacing: -0.5,
              color: OG.muted,
            }}
          >
            Signal from noise.
          </div>
          <div
            style={{
              marginTop: 6,
              marginLeft: -7,
              fontFamily: OG_FONT.serif,
              fontSize: 199,
              lineHeight: 1,
              letterSpacing: -6.6,
              whiteSpace: "nowrap",
            }}
          >
            {site.name}
          </div>
          <div style={{ marginTop: 26, height: 1, display: "flex", backgroundColor: OG.line }} />
          <div
            style={{
              marginTop: 22,
              display: "flex",
              justifyContent: "space-between",
              color: OG.muted,
              ...eyebrowStyle,
            }}
          >
            <span>Machine learning for cybersecurity</span>
            <span>{`${site.location.city}, ${site.location.country}`}</span>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: OG_FONT.serif, data: serif, style: "normal", weight: 400 },
        { name: OG_FONT.serif, data: serifItalic, style: "italic", weight: 400 },
        { name: OG_FONT.mono, data: mono, style: "normal", weight: 400 },
      ],
    },
  );
}
