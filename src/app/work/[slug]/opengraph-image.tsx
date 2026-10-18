import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { eyebrowStyle, OG, OG_FONT, OG_SIZE } from "@/components/seo/og";
import { ProjectGlyph } from "@/components/seo/og-glyphs";
import { getProject } from "@/content/projects";
import { site } from "@/content/site";

// Read once at module scope (request-independent), resolved from the project root. ~470KB total,
// inside the 500KB ImageResponse budget.
const [serif, sans, sansSemiBold, mono] = await Promise.all([
  readFile(join(process.cwd(), "src/assets/fonts/InstrumentSerif-Regular.ttf")),
  readFile(join(process.cwd(), "src/assets/fonts/Geist-Regular.ttf")),
  readFile(join(process.cwd(), "src/assets/fonts/Geist-SemiBold.ttf")),
  readFile(join(process.cwd(), "src/assets/fonts/GeistMono-Regular.ttf")),
]);

/**
 * One card per case study, with its own alt (a static `alt` export gives every card the same text,
 * and the wrong role on the internship). Served at /work/<slug>/opengraph-image/card; Next derives
 * the image route's static params from this, so a generateStaticParams export here would clash.
 * Unknown slugs get no card (the page falls back to the site card, the image URL 404s).
 */
export function generateImageMetadata({ params }: { params: { slug: string } }) {
  const project = getProject(params.slug);
  if (!project) return [];
  return [
    {
      id: "card",
      alt: `${project.title} — case study by ${site.name}, ${project.role.toLowerCase()} at ${project.org}`,
      size: OG_SIZE,
      contentType: "image/png",
    },
  ];
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) return new Response("Not found", { status: 404 });
  const [metric] = project.metrics;

  return new ImageResponse(
    (
      <div
        style={{
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", ...eyebrowStyle }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, color: OG.muted }}>
            <span style={{ color: OG.accent }}>{`(${project.index})`}</span>
            <div style={{ width: 36, height: 1, display: "flex", backgroundColor: OG.line }} />
            <span>Case study</span>
          </div>
          <span style={{ color: OG.subtle }}>{[project.org, project.role, project.period].filter(Boolean).join(" · ")}</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 48 }}>
            {/* Narrow enough that every title breaks into two balanced lines: one consistent layout. */}
            <div
              style={{
                maxWidth: 860,
                fontFamily: OG_FONT.serif,
                fontSize: 96,
                lineHeight: 0.98,
                letterSpacing: -2.3,
                textWrap: "balance",
              }}
            >
              {project.title}
            </div>
            <ProjectGlyph visual={project.visual} />
          </div>

          <div style={{ marginTop: 36, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 48 }}>
            <div
              style={{
                maxWidth: 640,
                fontFamily: OG_FONT.sans,
                fontSize: 26,
                lineHeight: 1.42,
                color: OG.muted,
                textWrap: "pretty",
              }}
            >
              {project.oneLiner}
            </div>
            {metric ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  flexShrink: 0,
                  paddingLeft: 32,
                  borderLeft: `1px solid ${OG.line}`,
                  fontFamily: OG_FONT.sans,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: OG.accent }} />
                  <span style={{ fontWeight: 600, fontSize: 64, lineHeight: 1, letterSpacing: -2 }}>{metric.value}</span>
                </div>
                <span style={{ marginTop: 12, fontSize: 22, lineHeight: 1.2, color: OG.muted }}>{metric.label}</span>
              </div>
            ) : null}
          </div>

          <div style={{ marginTop: 44, height: 1, display: "flex", backgroundColor: OG.line }} />
          <div style={{ marginTop: 22, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontFamily: OG_FONT.serif, fontSize: 36, lineHeight: 1, letterSpacing: -0.5 }}>
              {site.name}
            </span>
            <span style={{ color: OG.muted, ...eyebrowStyle }}>{`${site.role} — ${site.company}`}</span>
          </div>
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: [
        { name: OG_FONT.serif, data: serif, style: "normal", weight: 400 },
        { name: OG_FONT.sans, data: sans, style: "normal", weight: 400 },
        { name: OG_FONT.sans, data: sansSemiBold, style: "normal", weight: 600 },
        { name: OG_FONT.mono, data: mono, style: "normal", weight: 400 },
      ],
    },
  );
}
