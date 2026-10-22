import { PeriodicTable } from "@/components/toolkit/periodic-table";
import { toolkitElements, toolkitGroups } from "@/components/toolkit/toolkit-data";
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
          heading={
            <>
              {"Every skill, one "}
              <span data-hl className="hl italic">
                table.
              </span>
            </>
          }
        />
        <PeriodicTable elements={toolkitElements} groups={toolkitGroups} />
      </div>
    </section>
  );
}
