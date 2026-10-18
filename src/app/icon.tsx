import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { OG, OG_FONT } from "@/components/seo/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

const serif = await readFile(join(process.cwd(), "src/assets/fonts/InstrumentSerif-Regular.ttf"));

/** Favicon: the header logo ("Sabarish.") reduced to its initial and the accent full stop. */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 7,
          backgroundColor: OG.bg,
          // Keeps the tile's edge visible on dark tab strips.
          border: "1px solid rgba(237, 234, 228, 0.16)",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-end", marginTop: 1 }}>
          {/* A hairline stroke thickens the serif's thin strokes so it survives 16px. */}
          <span
            style={{
              fontFamily: OG_FONT.serif,
              fontSize: 29,
              lineHeight: 0.8,
              color: OG.fg,
              WebkitTextStroke: `0.9px ${OG.fg}`,
            }}
          >
            S
          </span>
          <div style={{ width: 5, height: 5, borderRadius: 5, marginLeft: 1, marginBottom: 1, backgroundColor: OG.accent }} />
        </div>
      </div>
    ),
    { ...size, fonts: [{ name: OG_FONT.serif, data: serif, style: "normal", weight: 400 }] },
  );
}
