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
          compact
          index="03"
          label="Projects"
          headingId="work-title"
          heading={
            <>
              <span data-hl className="hl italic">
                Proof,
              </span>
              {" not promises."}
            </>
          }
          // The systems are confidential: say so, or the visuals pass for screenshots of them.
          aside={
            <RevealText delay={0.15} className="eyebrow flex flex-col gap-1.5 text-fg-muted lg:items-end lg:pb-3">
              <span className="text-fg">Confidential systems</span>
              <span>Illustrations, not screenshots</span>
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
