import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { RevealText } from "./reveal-text";

/**
 * Standard section opener: "(02) Selected work" eyebrow + serif display heading.
 * `headingId` should be referenced by the section's aria-labelledby.
 */
export function SectionHeader({
  index,
  label,
  heading,
  headingId,
  aside,
  className,
}: {
  index: string;
  label: string;
  heading: ReactNode;
  headingId: string;
  /** Optional right-aligned element (count, short intro). */
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-(--header-gap) grid grid-cols-12 items-end gap-x-6 gap-y-6", className)}>
      <p className="eyebrow col-span-12 flex items-center gap-3 text-fg-muted">
        <span className="text-accent-ink">({index})</span>
        <span aria-hidden className="h-px w-8 bg-line-strong" />
        {label}
      </p>
      <RevealText as="h2" id={headingId} className="col-span-12 font-serif text-display lg:col-span-8">
        {heading}
      </RevealText>
      {aside ? <div className="col-span-12 lg:col-span-4 lg:justify-self-end">{aside}</div> : null}
    </header>
  );
}
