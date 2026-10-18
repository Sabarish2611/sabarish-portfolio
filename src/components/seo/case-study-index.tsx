import Link from "next/link";
import { projects } from "@/content/projects";

/** Compact index of the case studies — the 404's "where to next". */
export function CaseStudyIndex() {
  return (
    <nav aria-labelledby="case-study-index-title">
      <h2 id="case-study-index-title" className="eyebrow text-fg-muted">
        Case studies
      </h2>
      <ul className="mt-5 border-t border-line">
        {projects.map((project) => (
          <li key={project.slug} className="border-b border-line">
            <Link
              href={`/work/${project.slug}`}
              transitionTypes={["nav-forward"]}
              className="group flex min-h-16 items-center gap-5 py-3"
            >
              <span className="eyebrow w-6 shrink-0 text-fg-muted transition-colors duration-300 group-hover:text-accent-ink">
                {project.index}
              </span>
              <span className="font-serif text-title">
                <span className="link-draw">{project.shortTitle}</span>
              </span>
              <span
                aria-hidden
                className="ml-auto text-fg-muted transition-[translate,color] duration-500 ease-out group-hover:translate-x-1 group-hover:text-fg"
              >
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
