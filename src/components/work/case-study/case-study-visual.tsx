import { ViewTransition } from "react";
import { ProjectVisual } from "@/components/work/visuals";
import type { Project } from "@/content/projects";

/**
 * The project's illustrative visual in a large frame. The named ViewTransition pairs with the home
 * card's visual so it morphs between the two pages; the frame itself never animates its geometry,
 * which would shift the morph's landing spot.
 */
export function CaseStudyVisual({ project }: { project: Project }) {
  return (
    <figure aria-hidden className="container-page mt-[clamp(3rem,1.5rem+4vw,6rem)]">
      {/* Short screens (landscape phones) cap it so it never outgrows the viewport; svh is static,
          so the morph's landing spot stays put. */}
      <div className="relative aspect-4/3 overflow-hidden rounded-card border border-line bg-bg-sunken md:aspect-video [@media(max-height:30rem)]:aspect-auto [@media(max-height:30rem)]:h-[60svh]">
        <ViewTransition name={`project-visual-${project.slug}`} share="morph" default="none">
          <ProjectVisual visual={project.visual} variant="hero" className="size-full" />
        </ViewTransition>
      </div>
      <figcaption data-cs-fade className="eyebrow mt-4 flex items-center justify-between gap-6 text-fg-muted">
        <span>
          Fig. {project.index}
          <span className="max-md:hidden"> — {project.shortTitle}</span>
        </span>
        <span>Illustrative</span>
      </figcaption>
    </figure>
  );
}
