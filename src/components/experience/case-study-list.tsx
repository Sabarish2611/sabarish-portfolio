import Link from "next/link";
import type { Project } from "@/content/projects";

/** A role's related case studies as hairline rows: name and arrow. */
export function CaseStudyList({ id, projects }: { id: string; projects: readonly Project[] }) {
  const labelId = `${id}-case-studies`;

  return (
    <div className="mt-10 md:mt-14">
      <p id={labelId} data-tl-item data-reveal className="eyebrow flex items-center gap-3 text-fg-muted">
        Case studies
      </p>
      {/* role="list": Safari drops list semantics once list-style is none. */}
      <ul role="list" aria-labelledby={labelId} className="mt-4 border-t border-line">
        {projects.map((project) => (
          <li key={project.slug} data-tl-item data-reveal className="border-b border-line">
            <Link
              href={`/work/${project.slug}`}
              prefetch
              transitionTypes={["nav-forward"]}
              className="group -mx-3 grid min-h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 rounded-xl px-3 py-3 transition-colors duration-300 hover:bg-fg/[0.04] focus-visible:bg-fg/[0.04] sm:gap-x-5"
            >
              <span className="min-w-0 text-base text-fg sm:text-lg">{project.shortTitle}</span>
              <span
                aria-hidden
                className="text-fg-muted transition duration-500 ease-out group-hover:translate-x-1 group-hover:text-fg group-focus-visible:translate-x-1"
              >
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
