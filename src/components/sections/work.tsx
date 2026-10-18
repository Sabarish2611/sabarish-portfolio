import { RevealText } from "@/components/ui/reveal-text";
import { SectionHeader } from "@/components/ui/section-header";
import { DECK_ITEM_CLASS, deckItemVars } from "@/components/work/cards/deck";
import { ProjectCard } from "@/components/work/cards/project-card";
import { ProjectDeck } from "@/components/work/cards/project-deck";
import { projects } from "@/content/projects";

export function Work() {
  const total = projects.length;

  return (
    <section id="work" aria-labelledby="work-title" className="section-pad">
      <div className="container-page">
        <SectionHeader
          index="02"
          label="Selected work"
          headingId="work-title"
          heading={
            <>
              Four systems, real numbers.
            </>
          }
          aside={
            <RevealText delay={0.15} className="max-w-[36ch] text-fg-muted">
              Four case studies, built at Trellix — three in my data-scientist role, one as an intern. The systems
              are confidential, so the visuals are illustrations, not screenshots.
            </RevealText>
          }
        />

        <ProjectDeck count={total}>
          {projects.map((project, i) => (
            <li key={project.slug} style={deckItemVars(i)} className={DECK_ITEM_CLASS}>
              <ProjectCard project={project} total={total} />
            </li>
          ))}
        </ProjectDeck>
      </div>
    </section>
  );
}
