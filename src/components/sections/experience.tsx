import { CaseStudyList } from "@/components/experience/case-study-list";
import { ChapterMarker } from "@/components/experience/chapter-marker";
import { TimelineEntry } from "@/components/experience/timeline-entry";
import { timelineItems, timelineOrgs, timelineSpan } from "@/components/experience/timeline-items";
import { TimelineMotion } from "@/components/experience/timeline-motion";
import { TimelineTrack } from "@/components/experience/timeline-track";
import { SectionHeader } from "@/components/ui/section-header";
import { Stat } from "@/components/ui/stat";

/** (03) Experience — roles and education on a timeline whose line draws as you scroll. */
export function Experience() {
  return (
    <section id="experience" aria-labelledby="experience-title" className="section-pad">
      <TimelineMotion className="container-page">
        <SectionHeader
          index="03"
          label="Experience"
          headingId="experience-title"
          heading="The work so far."
          aside={
            <p data-tl-item data-reveal className="eyebrow flex flex-col gap-1.5 text-fg-muted lg:items-end lg:pb-3">
              <span className="text-fg">{timelineSpan(timelineItems)}</span>
              <span>{timelineOrgs(timelineItems).join(" · ")}</span>
            </p>
          }
        />

        <div className="grid grid-cols-12 gap-x-6">
          <div className="hidden lg:col-span-3 lg:block">
            <ChapterMarker items={timelineItems} />
          </div>

          <div className="relative col-span-12 lg:col-span-8 lg:col-start-5">
            <TimelineTrack />
            <ol role="list" className="flex flex-col gap-[clamp(5rem,10vw,10rem)]">
              {timelineItems.map((item) => (
                <TimelineEntry key={item.id} item={item}>
                  {item.projects.length > 0 ? <CaseStudyList id={item.id} projects={item.projects} /> : null}
                  {item.cgpa ? (
                    <dl data-tl-item data-reveal className="mt-8 md:mt-10">
                      <Stat value={item.cgpa} label="CGPA" />
                    </dl>
                  ) : null}
                </TimelineEntry>
              ))}
            </ol>
          </div>
        </div>
      </TimelineMotion>
    </section>
  );
}
