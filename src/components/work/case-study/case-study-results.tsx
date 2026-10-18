import { Stat } from "@/components/ui/stat";
import type { Metric } from "@/content/projects";
import { CaseStudySection } from "./case-study-section";

/**
 * Results band in two tiers: the first metric is the page's single hero figure at full width; the
 * rest share a row beneath it on lg, aligned to the content edge of the split chapters (columns
 * 5-12), separated by hairlines. Each cell clips so values can rise out of it (data-cs-stats).
 */
export function CaseStudyResults({ metrics }: { metrics: readonly Metric[] }) {
  const [headline, ...rest] = metrics;
  if (!headline) return null;

  return (
    <CaseStudySection label="Results" id="results" layout="stacked">
      <div className="grid grid-cols-12 gap-x-6 gap-y-10">
        <dl data-cs-stats className="col-span-12 grid">
          <Stat
            value={headline.value}
            label={headline.label}
            size="figure"
            className="overflow-clip lg:[&>dd]:text-[length:clamp(6rem,2rem+6vw,9rem)]"
          />
        </dl>
        {rest.length > 0 ? (
          <dl
            data-cs-stats
            className="col-span-12 grid grid-cols-2 gap-x-6 gap-y-10 lg:col-span-8 lg:col-start-5 lg:grid-cols-3"
          >
            {rest.map((metric) => (
              <Stat
                key={metric.label}
                value={metric.value}
                label={metric.label}
                className="justify-end overflow-clip border-t border-line pt-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6 [&>dt]:min-h-[2lh]"
              />
            ))}
          </dl>
        ) : null}
      </div>
    </CaseStudySection>
  );
}
