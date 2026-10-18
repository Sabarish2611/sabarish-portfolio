import Link from "next/link";
import { ViewTransition } from "react";
import { Stat } from "@/components/ui/stat";
import { ProjectVisual } from "@/components/work/visuals";
import type { Project } from "@/content/projects";
import { cn } from "@/lib/cn";
import { DECK_CARD_CLASS } from "./deck";

/** Three tools keep the stack line to two lines at most, at any card width; the "+N" counts the rest. */
const STACK_ITEMS = 3;
/** Two headline metrics per card keeps every card in the deck on the same grid; the case study lists all. */
const CARD_METRICS = 2;

/**
 * Home-page project card. The title is a stretched link (the whole card is the hit area); the
 * visual morphs into the case-study page through the shared ViewTransition name. `data-card-*`
 * hooks belong to the motion layer in project-deck.tsx.
 */
export function ProjectCard({ project, total }: { project: Project; total: number }) {
  const metrics = project.metrics.slice(0, CARD_METRICS);
  const stack = project.stack.slice(0, STACK_ITEMS);
  const moreTools = project.stack.length - stack.length;

  return (
    <article
      data-card
      data-cursor="view"
      className={cn(
        "group/card relative isolate grid overflow-hidden rounded-card border border-line bg-bg-elevated transition-colors duration-500 hover:border-line-strong lg:grid-cols-12",
        "has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-4 has-[a:focus-visible]:outline-accent-ink",
        DECK_CARD_CLASS,
      )}
    >
      {/* 6/6 on lg keeps the copy column readable at 1024px; the 5/7 editorial split from xl.
          Short screens (< 49rem, i.e. cards under ~600px in the deck) get a tighter rhythm. */}
      <div
        className={cn(
          "flex flex-col gap-10 p-6 sm:p-8 lg:col-span-6 xl:col-span-5 xl:p-10",
          "lg:[@media(max-height:49rem)]:gap-5 xl:[@media(max-height:49rem)]:p-8",
        )}
      >
        <div className="flex flex-col">
          <h3 className="mt-4 font-serif text-headline lg:[@media(max-height:49rem)]:mt-3">
            <Link
              href={`/work/${project.slug}`}
              prefetch={true}
              transitionTypes={["nav-forward"]}
              className="block after:absolute after:inset-0 after:z-10 after:rounded-card focus-visible:outline-none"
            >
              {/* Mask for the entrance slide; the padding keeps ascenders and descenders unclipped. */}
              <span className="-my-[0.12em] block overflow-y-clip py-[0.12em]">
                <span data-card-title data-reveal className="block">
                  {project.shortTitle}
                </span>
              </span>
            </Link>
          </h3>

          <p data-card-copy data-reveal className="mt-4 max-w-[44ch] text-fg-muted lg:mt-5">
            {project.oneLiner}
          </p>

          {/* The one meta line, above the title (decorative: the list itself carries the order). */}
          <p data-card-meta data-reveal aria-hidden className="eyebrow order-first text-fg-subtle">
            <span className="text-accent-ink">{project.index}</span> / {String(total).padStart(2, "0")}
          </p>
        </div>

        {/* Two columns that line up card to card; a wide first value ("70% → 30%") widens its
            column instead of wrapping, and the second stat drops below only when both can't fit. */}
        <dl data-card-stats data-reveal className="flex flex-wrap gap-6">
          {metrics.map((metric, i) => (
            <Stat
              key={metric.label}
              value={metric.value}
              label={metric.label}
              // overflow-clip doubles as the mask for the value/label slide-up.
              className={cn(
                "overflow-clip",
                i === 0 ? "min-w-[calc(50%-0.75rem)] shrink-0" : "min-w-min grow basis-0",
              )}
            />
          ))}
        </dl>

        <div
          data-card-footer
          data-reveal
          className="mt-auto flex flex-col gap-4 border-t border-line pt-5 sm:flex-row sm:items-end sm:justify-between sm:gap-8"
        >
          {/* One inline run: every piece leads with a separator and the run is shifted left by one
              separator width inside a clipping box, so the one opening each line is clipped and no
              line starts or ends with a dot, whatever wraps where. Nothing is clamped, so the "+N"
              (outside the list: it is a count, not a tool) shows at any width or text spacing.
              Line pitch = label line height + 0.375rem; the negative margin trims the outer
              half-leading so the first and last lines sit on the box edges. */}
          <div className="eyebrow min-w-0 overflow-hidden sm:flex-1">
            <div className="-my-0.75 -ml-6 leading-[calc(1.25em+0.375rem)] text-fg-muted">
              <ul role="list" aria-label="Stack" className="inline">
                {stack.map((item) => (
                  <li key={item} className="inline-flex whitespace-nowrap">
                    <span aria-hidden className="w-6 shrink-0 text-center text-fg-subtle">
                      ·
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
              {moreTools > 0 ? (
                <span className="inline-flex whitespace-nowrap">
                  <span aria-hidden className="w-6 shrink-0 text-center text-fg-subtle">
                    ·
                  </span>
                  +{moreTools}
                  <span className="sr-only"> more in the case study</span>
                </span>
              ) : null}
            </div>
          </div>
          {/* Visual-only affordance: the title link carries the name and the click. */}
          <span aria-hidden className="eyebrow flex shrink-0 items-center gap-2 text-fg">
            <span className="link-draw pb-0.5 group-hover/card:bg-size-[100%_1px] group-has-[a:focus-visible]/card:bg-size-[100%_1px]">
              Read case study
            </span>
            <span className="transition-transform duration-500 ease-out group-hover/card:translate-x-1 group-has-[a:focus-visible]/card:translate-x-1 motion-reduce:transition-none">
              →
            </span>
          </span>
        </div>
      </div>

      {/* Short screens (landscape phones) cap the stacked visual so the card's text starts on screen. */}
      <div
        aria-hidden
        className={cn(
          "relative isolate order-first m-3 mb-0 aspect-4/3 overflow-hidden rounded-[calc(var(--radius-card)-0.75rem)] border border-line bg-bg-sunken md:aspect-video lg:order-none lg:col-span-6 lg:mb-3 lg:ml-0 lg:aspect-auto xl:col-span-7",
          "max-lg:[@media(max-height:30rem)]:aspect-auto max-lg:[@media(max-height:30rem)]:h-[60svh]",
        )}
      >
        <div className="size-full transition-transform duration-[1200ms] ease-out motion-safe:group-hover/card:scale-[1.03] motion-safe:group-has-[a:focus-visible]/card:scale-[1.03]">
          <ViewTransition name={`project-visual-${project.slug}`} share="morph" default="none">
            <ProjectVisual visual={project.visual} variant="card" className="size-full" />
          </ViewTransition>
        </div>
      </div>

      {/* Dims the card as the next one slides over it (deck scrub). */}
      <div
        data-card-shade
        aria-hidden
        className="pointer-events-none absolute inset-0 z-20 bg-black opacity-0 light:bg-bg-sunken"
      />
    </article>
  );
}
