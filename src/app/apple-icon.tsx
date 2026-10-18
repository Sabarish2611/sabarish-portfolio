import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { OG, OG_FONT } from "@/components/seo/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const serif = await readFile(join(process.cwd(), "src/assets/fonts/InstrumentSerif-Regular.ttf"));

/** Home-screen icon. Full-bleed square: iOS applies its own rounded mask. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: OG.bg,
          backgroundImage: "radial-gradient(circle at 70% 78%, rgba(198, 244, 50, 0.12), rgba(198, 244, 50, 0) 55%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-end", marginTop: 6 }}>
          <span style={{ fontFamily: OG_FONT.serif, fontSize: 150, lineHeight: 0.8, color: OG.fg }}>S</span>
          <div style={{ width: 22, height: 22, borderRadius: 22, marginLeft: 6, marginBottom: 6, backgroundColor: OG.accent }} />
        </div>
      </div>
    ),
    { ...size, fonts: [{ name: OG_FONT.serif, data: serif, style: "normal", weight: 400 }] },
  );
}
