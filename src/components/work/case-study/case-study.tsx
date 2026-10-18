import { RevealText } from "@/components/ui/reveal-text";
import type { Project } from "@/content/projects";
import { CaseStudyApproach } from "./case-study-approach";
import { CaseStudyHero } from "./case-study-hero";
import { CaseStudyMotion } from "./case-study-motion";
import { CaseStudyResults } from "./case-study-results";
import { CaseStudySection } from "./case-study-section";
import { CaseStudyVisual } from "./case-study-visual";
import { ChipList } from "./chip-list";
import { NextProject } from "./next-project";

/** The /work/[slug] page body. Server-rendered; CaseStudyMotion adds the choreography. */
export function CaseStudy({ project, next, total }: { project: Project; next: Project; total: number }) {
  return (
    <CaseStudyMotion>
      <article aria-labelledby="case-title">
        <CaseStudyHero project={project} />
        <CaseStudyVisual project={project} />

        <div className="flex flex-col gap-[clamp(5.5rem,2.5rem+8vw,11rem)] pt-[clamp(4.5rem,2.5rem+6vw,9rem)]">
          <CaseStudyResults metrics={project.metrics} />

          <CaseStudySection label="The problem" id="problem">
            <RevealText as="p" className="max-w-[34ch] font-serif text-statement">
              {project.problem}
            </RevealText>
          </CaseStudySection>

          <CaseStudyApproach steps={project.approach} />

          <CaseStudySection label="The outcome" id="outcome" layout="stacked">
            <RevealText as="p" className="max-w-[34ch] font-serif text-headline text-balance">
              {project.outcome}
            </RevealText>
          </CaseStudySection>

          <CaseStudySection label="Stack" id="stack">
            <ChipList data-cs-chips aria-label="Technologies" items={project.stack} />
            <p data-cs-fade className="eyebrow mt-12 flex items-start gap-3 text-fg-muted">
              <span aria-hidden className="mt-[0.625em] h-px w-8 shrink-0 bg-line-strong" />
              Details are generalized — this was confidential work at {project.org}.
            </p>
          </CaseStudySection>
        </div>
      </article>

      <NextProject project={next} total={total} />
    </CaseStudyMotion>
  );
}
