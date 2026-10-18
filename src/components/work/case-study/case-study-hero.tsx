import Link from "next/link";
import { FocusOnNavigate } from "@/components/a11y/focus-on-navigate";
import { RevealText } from "@/components/ui/reveal-text";
import type { Project } from "@/content/projects";
import { ChipList } from "./chip-list";

const DOT =
  "relative pl-6 before:absolute before:top-1/2 before:left-2.5 before:size-1 before:-translate-y-1/2 before:rounded-full before:bg-fg-subtle";

/** Back link, meta line, title, one-liner and domains. `data-cs-intro` items enter after the intro. */
export function CaseStudyHero({ project }: { project: Project }) {
  const meta = [project.org, project.period, project.role].filter((item): item is string => Boolean(item));

  return (
    <header className="container-page pt-[calc(var(--header-h)+1.5rem)]">
      <Link
        href="/#work"
        transitionTypes={["nav-back"]}
        data-cs-intro
        data-reveal
        className="eyebrow group -ml-1 inline-flex h-10 items-center gap-3 px-1 text-fg-muted transition-colors duration-300 hover:text-fg"
      >
        <span
          aria-hidden
          className="transition-transform duration-500 ease-out group-hover:-translate-x-1 motion-reduce:transition-none"
        >
          ←
        </span>
        <span className="link-draw">All work</span>
      </Link>

      <div className="grid grid-cols-12 gap-x-6 pt-[clamp(2.5rem,1rem+5vw,6.5rem)]">
        {/* Each item carries its dot in a left gutter; the list is pulled left by that gutter inside a
            clipping wrapper, so a dot that would start a wrapped line is clipped away. */}
        <div data-cs-intro data-reveal className="col-span-12 overflow-hidden">
          <ul aria-label="Project details" className="eyebrow -ml-6 flex flex-wrap gap-y-2 text-fg-muted">
            <li className={DOT}>
              <span className="text-accent-ink">
                <span className="sr-only">Case study </span>
                {project.index}
              </span>
            </li>
            {meta.map((item) => (
              <li key={item} className={DOT}>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <RevealText
          as="h1"
          id="case-title"
          intro
          className="col-span-12 mt-5 -ml-[0.04em] font-serif text-display lg:col-span-11 2xl:col-span-10"
        >
          {project.title}
        </RevealText>
        {/* Client navigation lands focus on the title, so the page is announced and Tab starts here. */}
        <FocusOnNavigate target="case-title" />

        <div className="col-span-12 mt-10 flex flex-col gap-7 md:col-span-9 lg:col-span-6 lg:col-start-7 lg:mt-12">
          <p data-cs-intro data-reveal className="max-w-[46ch] text-lead text-fg-muted">
            {project.oneLiner}
          </p>
          <ChipList data-cs-intro data-reveal aria-label="Domains" items={project.domains} tone="strong" />
        </div>
      </div>
    </header>
  );
}
