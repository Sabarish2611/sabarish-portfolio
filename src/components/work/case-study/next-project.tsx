import Link from "next/link";
import type { Project } from "@/content/projects";
import { cn } from "@/lib/cn";

const pad = (n: number) => String(n).padStart(2, "0");
const WIPE = "transition-transform duration-700 ease-in-out motion-reduce:transition-none";

/**
 * Full-width link to the next case study. On hover/focus an accent panel wipes in from the left:
 * the panel slides in while its copy of the content slides the opposite way, so the copy stays
 * put and the text flips to on-accent exactly at the wipe's edge — transforms only.
 */
export function NextProject({ project, total }: { project: Project; total: number }) {
  return (
    <nav aria-label="Next project" className="mt-[clamp(6rem,3rem+9vw,13rem)]">
      <Link
        href={`/work/${project.slug}`}
        transitionTypes={["nav-forward"]}
        prefetch
        data-cursor="view"
        className={cn(
          "group relative block overflow-hidden border-t border-line focus-visible:rounded-none focus-visible:outline-none",
          // Focus ring above the wipe layer (the native outline would paint underneath it).
          "after:pointer-events-none after:absolute after:inset-2 after:border-2 after:border-transparent focus-visible:after:border-on-accent",
        )}
      >
        <NextProjectBody project={project} total={total} />
        <span
          aria-hidden
          className={cn(
            "absolute inset-0 -translate-x-full overflow-hidden bg-accent text-on-accent group-hover:translate-x-0 group-focus-visible:translate-x-0",
            WIPE,
          )}
        >
          <span className={cn("block size-full translate-x-full group-hover:translate-x-0 group-focus-visible:translate-x-0", WIPE)}>
            <NextProjectBody project={project} total={total} overlay />
          </span>
        </span>
      </Link>
    </nav>
  );
}

function NextProjectBody({ project, total, overlay = false }: { project: Project; total: number; overlay?: boolean }) {
  return (
    <span className="container-page grid grid-cols-12 items-end gap-x-6 gap-y-8 py-[clamp(3rem,1.5rem+5vw,7rem)]">
      <span className={cn("eyebrow col-span-12 flex items-center justify-between", !overlay && "text-fg-muted")}>
        <span className="flex items-center gap-3">
          <span aria-hidden className={cn("size-2 rounded-[2px]", overlay ? "bg-on-accent" : "bg-accent-ink")} />
          Next project
        </span>
        <span>
          {project.index} / {pad(total)}
        </span>
      </span>
      {/* The base copy's title rises out of this mask on scroll (data-cs-rise). Phones give it the
          full width (balanced, so no line is a lone word) and drop the arrow below it. */}
      <span className="reveal-line-mask col-span-12 block overflow-clip sm:col-span-10">
        <span data-cs-rise={overlay ? undefined : ""} className="block font-serif text-display text-balance">
          {project.title}
        </span>
      </span>
      <span className="col-span-12 justify-self-end pb-[0.12em] font-serif text-display leading-none sm:col-span-2">
        <svg
          aria-hidden
          viewBox="0 0 48 48"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.25"
          className="mr-[0.1em] size-[0.62em] transition-transform duration-700 ease-out group-hover:translate-x-[0.1em] motion-reduce:transition-none"
        >
          <path vectorEffect="non-scaling-stroke" d="M4 24h39M29 10l14 14-14 14" />
        </svg>
      </span>
    </span>
  );
}
