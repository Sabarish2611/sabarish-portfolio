import { PeriodicTable } from "@/components/toolkit/periodic-table";
import { toolkitElements, toolkitGroups } from "@/components/toolkit/toolkit-data";
import { RevealText } from "@/components/ui/reveal-text";
import { SectionHeader } from "@/components/ui/section-header";

export function Toolkit() {
  return (
    <section id="toolkit" aria-labelledby="toolkit-title" className="section-pad">
      <div className="container-page">
        <SectionHeader
          compact
          index="04"
          label="Toolkit"
          headingId="toolkit-title"
          heading="Raw data to production."
          aside={
            <RevealText delay={0.15} className="eyebrow flex flex-col gap-1.5 text-fg-muted lg:items-end lg:pb-3">
              <span className="text-fg">{`${toolkitElements.length} elements in ${toolkitGroups.length} groups`}</span>
              <span>Numbered in résumé order</span>
            </RevealText>
          }
        />
        <PeriodicTable elements={toolkitElements} groups={toolkitGroups} />
      </div>
    </section>
  );
}
