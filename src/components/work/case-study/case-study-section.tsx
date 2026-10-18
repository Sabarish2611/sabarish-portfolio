import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * A case-study chapter: a hairline rule that draws in, a label in the first four columns,
 * and the content beside it ("split") or underneath at full width ("stacked").
 */
export function CaseStudySection({
  label,
  id,
  layout = "split",
  aside,
  children,
  className,
}: {
  label: string;
  /** The heading gets `${id}-title`, which labels the section. */
  id: string;
  layout?: "split" | "stacked";
  /** Extra content under the label (split layout). Sticks while the chapter scrolls on large screens. */
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const titleId = `${id}-title`;
  const split = layout === "split";

  return (
    <section aria-labelledby={titleId} className={cn("container-page", className)}>
      <div aria-hidden data-cs-rule className="h-px bg-line-strong" />
      <div className="grid grid-cols-12 gap-x-6 gap-y-10 pt-6 lg:pt-8">
        <div className={cn("col-span-12", split && "lg:col-span-4")}>
          <div className={cn(aside ? "lg:sticky lg:top-[calc(var(--header-h)+2rem)]" : undefined)}>
            <h2 id={titleId} className="eyebrow flex items-center gap-3 text-fg-muted">
              <span aria-hidden className="h-px w-8 bg-line-strong" />
              {label}
            </h2>
            {aside}
          </div>
        </div>
        <div className={cn("col-span-12", split && "lg:col-span-8")}>{children}</div>
      </div>
    </section>
  );
}
