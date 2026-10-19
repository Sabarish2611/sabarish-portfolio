import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { DecodeText } from "./decode-text";
import { RevealText } from "./reveal-text";

/**
 * Standard section opener: "(03) Projects" eyebrow + serif display heading.
 * `headingId` should be referenced by the section's aria-labelledby.
 */
export function SectionHeader({
  index,
  label,
  heading,
  headingId,
  aside,
  compact = false,
  className,
}: {
  index: string;
  label: string;
  heading: ReactNode;
  headingId: string;
  /** Optional right-aligned element (count, short intro). */
  aside?: ReactNode;
  /** For sections that fit one screen: the heading and the gap below it follow the screen's height. */
  compact?: boolean;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "grid grid-cols-12 items-end gap-x-3 gap-y-6 sm:gap-x-6",
        compact ? "mb-[clamp(1.75rem,5svh,3.5rem)]" : "mb-(--header-gap)",
        className,
      )}
    >
      <p className="eyebrow col-span-12 flex items-center gap-3 text-fg-muted">
        <span className="text-accent-ink">({index})</span>
        <span aria-hidden className="h-px w-8 bg-line-strong" />
        <DecodeText>{label}</DecodeText>
      </p>
      <RevealText
        as="h2"
        id={headingId}
        className={cn(
          "col-span-12 font-serif lg:col-span-8",
          compact ? "text-[length:clamp(2.75rem,min(6vw,8svh),6.5rem)] leading-[0.92] tracking-[-0.03em]" : "text-display",
        )}
      >
        {heading}
      </RevealText>
      {aside ? <div className="col-span-12 lg:col-span-4 lg:justify-self-end">{aside}</div> : null}
    </header>
  );
}
