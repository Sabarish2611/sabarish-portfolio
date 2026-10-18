import type { ApproachStep } from "@/content/projects";
import { CaseStudySection } from "./case-study-section";

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Numbered steps separated by hairlines. Rows reveal in batches; on large screens a sticky readout
 * beside the list (a thin accent line) tracks the step under the reading line.
 */
export function CaseStudyApproach({ steps }: { steps: readonly ApproachStep[] }) {
  return (
    <CaseStudySection label="The approach" id="approach" aside={<StepReadout />}>
      <ol data-cs-steps className="border-b border-line">
        {steps.map((step, i) => (
          <li
            key={step.title}
            data-cs-step
            className="group/step relative grid grid-cols-[2.5rem_1fr] gap-x-4 gap-y-3 py-8 first:pt-0 md:grid-cols-8 md:gap-x-6 lg:py-10"
          >
            {/* The chapter's own rule sits above the first step. */}
            {i > 0 ? <span aria-hidden data-cs-step-rule className="absolute inset-x-0 top-0 h-px bg-line" /> : null}
            <span
              aria-hidden
              className="pt-[0.45em] font-mono text-sm text-fg-muted transition-colors duration-500 group-data-[active=true]/step:text-accent-ink md:col-span-1"
            >
              {pad(i + 1)}
            </span>
            <h3 className="font-serif text-title md:col-span-3">{step.title}</h3>
            <p className="col-start-2 text-fg-muted md:col-span-4 md:col-start-auto md:pt-1">{step.body}</p>
          </li>
        ))}
      </ol>
    </CaseStudySection>
  );
}

/** Decorative progress readout; the motion layer drives it. Hidden on small screens and reduced motion. */
function StepReadout() {
  return (
    <div aria-hidden className="mt-10 hidden max-w-56 motion-safe:lg:block">
      <div className="h-px bg-line">
        <div data-cs-progress className="h-full bg-accent-ink" />
      </div>
    </div>
  );
}
