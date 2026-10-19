import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { buildConstellation, Constellation, DetectionBox, eyebrowStyle, OG, OG_FONT, OG_SIZE } from "@/components/seo/og";
import { site } from "@/content/site";

export const alt = `${site.name} — ${site.role}`;
export const size = OG_SIZE;
export const contentType = "image/png";

// Read once at module scope (request-independent), resolved from the project root.
const [serif, serifItalic, mono, portrait] = await Promise.all([
  readFile(join(process.cwd(), "src/assets/fonts/InstrumentSerif-Regular.ttf")),
  readFile(join(process.cwd(), "src/assets/fonts/InstrumentSerif-Italic.ttf")),
  readFile(join(process.cwd(), "src/assets/fonts/GeistMono-Regular.ttf")),
  // Cut to the card's exact size (324×518), so nothing is resampled at render time.
  readFile(join(process.cwd(), "src/assets/photos/og-portrait.jpg"), "base64"),
]);

/**
 * The portrait card, inset from the top-left like the site's photo cards and cut at the same two
 * corners (top-right, bottom-left). He looks right, into the card. Satori has no calc(): pixels.
 */
const PHOTO = { inset: 56, width: 324, height: 518, cut: 20 };
const PHOTO_CLIP = `polygon(0px 0px, ${PHOTO.width - PHOTO.cut}px 0px, ${PHOTO.width}px ${PHOTO.cut}px, ${PHOTO.width}px ${PHOTO.height}px, ${PHOTO.cut}px ${PHOTO.height}px, 0px ${PHOTO.height - PHOTO.cut}px)`;

// A latent-space still: grey classes, one accent class (the signal), a few anomalies.
const field = buildConstellation({
  seed: 20230701,
  clusters: [
    { x: 736, y: 168, spreadX: 30, spreadY: 20, count: 18 },
    { x: 912, y: 100, spreadX: 24, spreadY: 16, count: 14 },
    { x: 870, y: 252, spreadX: 28, spreadY: 15, count: 14 },
    { x: 1058, y: 196, spreadX: 24, spreadY: 20, count: 22, signal: true },
  ],
  noise: 14,
  anomalies: [
    { x: 1016, y: 88 },
    { x: 664, y: 238 },
    { x: 972, y: 296 },
  ],
  bounds: { x: 640, y: 40, width: 510, height: 262 },
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
          backgroundColor: OG.bg,
          color: OG.fg,
        }}
      >
        <Constellation field={field} />
        {field.signal ? <DetectionBox box={field.signal} label="Signal" /> : null}

        <div style={{ display: "flex", paddingTop: PHOTO.inset, paddingLeft: PHOTO.inset }}>
          <img
            src={`data:image/jpeg;base64,${portrait}`}
            alt=""
            width={PHOTO.width}
            height={PHOTO.height}
            style={{ width: PHOTO.width, height: PHOTO.height, clipPath: PHOTO_CLIP }}
          />
        </div>

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "60px 72px 54px 60px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14, color: OG.muted, ...eyebrowStyle }}>
            <div style={{ width: 10, height: 10, borderRadius: 10, backgroundColor: OG.accent }} />
            {`${site.company} — ${site.location.city}, ${site.location.country}`}
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                fontFamily: OG_FONT.serif,
                fontStyle: "italic",
                fontSize: 46,
                lineHeight: 1,
                letterSpacing: -0.4,
                color: OG.muted,
              }}
            >
              Signal from noise.
            </div>
            <div
              style={{
                marginTop: 8,
                marginLeft: -5,
                fontFamily: OG_FONT.serif,
                fontSize: 129,
                lineHeight: 1,
                letterSpacing: -4.3,
                whiteSpace: "nowrap",
              }}
            >
              {site.name}
            </div>
            <div style={{ marginTop: 24, height: 1, display: "flex", backgroundColor: OG.line }} />
            {/* The hero's label; it fills the row, so the location sits up top with the company. */}
            <div style={{ marginTop: 20, display: "flex", color: OG.muted, ...eyebrowStyle, fontSize: 17, letterSpacing: 1.8 }}>
              Data Scientist · AI Engineer · Forward Deployed Engineer
            </div>
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
