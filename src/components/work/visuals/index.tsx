import type { ProjectVisual as ProjectVisualKind } from "@/content/projects";
import { AutoencoderVisual } from "./autoencoder";
import { CategoriesVisual } from "./categories";
import { ClustersVisual } from "./clusters";
import { PipelineVisual } from "./pipeline";

export type ProjectVisualProps = {
  visual: ProjectVisualKind;
  /** "card" on the home page, "hero" (larger, more detail) on the case-study page. */
  variant?: "card" | "hero";
  className?: string;
};

/**
 * Illustrative, animated diagram of a project's idea (never a screenshot, never data). Fills its
 * container — give the parent a size (e.g. an aspect ratio) — and is decorative (aria-hidden).
 */
export function ProjectVisual({ visual, variant = "card", className }: ProjectVisualProps) {
  switch (visual) {
    case "clusters":
      return <ClustersVisual variant={variant} className={className} />;
    case "pipeline":
      return <PipelineVisual variant={variant} className={className} />;
    case "autoencoder":
      return <AutoencoderVisual variant={variant} className={className} />;
    case "categories":
      return <CategoriesVisual variant={variant} className={className} />;
  }
}
