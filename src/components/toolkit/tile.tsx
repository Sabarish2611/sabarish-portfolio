import type { CSSProperties, ReactNode } from "react";
import { DecodeText } from "@/components/ui/decode-text";
import { cn } from "@/lib/cn";

// Both layers read the pointer position from --mx/--my, which BentoGrid sets on the hovered tile.
const SPOTLIGHT: CSSProperties = {
  background: "radial-gradient(34rem circle at var(--mx, 50%) var(--my, 0%), var(--spot), transparent 62%)",
};

// The hairline brightens near the pointer: a smaller gradient painted only on the cut-corner ring.
const RIM: CSSProperties = {
  background: "radial-gradient(16rem circle at var(--mx, 50%) var(--my, 0%), var(--rim), transparent 70%)",
};

/**
 * One bento card: cut corners with a hairline ring, elevated surface, mono eyebrow title (h3) and an
 * optional right-aligned meta. On hover, neutral detection brackets lock on (the accent stays for
 * actions). Content after the header is laid out in a flex column, so `mt-auto` on a child pins it
 * to the bottom edge.
 */
export function Tile({
  title,
  meta,
  className,
  headerClassName,
  children,
}: {
  title: string;
  meta?: ReactNode;
  className?: string;
  headerClassName?: string;
  children: ReactNode;
}) {
  return (
    <div
      data-tile=""
      data-reveal=""
      className={cn(
        "group/tile chamfer relative isolate flex flex-col gap-8 bg-bg-elevated p-6 [--cut:1.25rem] lg:p-8 lg:[--cut:1.5rem]",
        // An ink haze in both themes: the accent is reserved for actions.
        "[--spot:color-mix(in_oklab,var(--fg)_5%,transparent)] [--rim:color-mix(in_oklab,var(--fg)_30%,transparent)]",
        className,
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-0 transition-opacity duration-500 ease-out group-hover/tile:opacity-100"
        style={SPOTLIGHT}
      />
      <span
        aria-hidden
        className="chamfer-ring pointer-events-none absolute inset-0 z-10 bg-line transition-colors duration-500 ease-out group-hover/tile:bg-line-strong"
      />
      <span
        aria-hidden
        className="chamfer-ring pointer-events-none absolute inset-0 z-10 opacity-0 transition-opacity duration-500 ease-out group-hover/tile:opacity-100"
        style={RIM}
      />
      <span
        aria-hidden
        className="detect-brackets pointer-events-none absolute inset-3 z-10 scale-[1.02] text-fg-subtle opacity-0 transition-[opacity,scale] duration-500 ease-out group-hover/tile:scale-100 group-hover/tile:opacity-100 motion-reduce:scale-100"
      />
      <div className={cn("flex items-center justify-between gap-4", headerClassName)}>
        <h3 className="eyebrow text-fg-muted">
          <DecodeText>{title}</DecodeText>
        </h3>
        {meta}
      </div>
      {children}
    </div>
  );
}

/** Skill chips: static hairline pills (not interactive, so no hover state). */
export function ChipList({ items, className }: { items: readonly string[]; className?: string }) {
  return (
    <ul className={cn("flex flex-wrap gap-2", className)}>
      {items.map((item) => (
        <li
          key={item}
          className="chamfer-outline px-3 py-1.5 text-sm text-fg [--cut:0.375rem] [--outline:var(--line)]"
        >
          {item}
        </li>
      ))}
    </ul>
  );
}

/**
 * A run of short items with decorative separators; each item stays on one line. Every item carries
 * a leading separator and the list is pulled left by one separator slot inside a clipping wrapper,
 * so wherever the list wraps, no line starts or ends with a dangling separator.
 */
export function InlineList({
  items,
  separator = "·",
  label,
  className,
}: {
  items: readonly string[];
  separator?: string;
  /** Accessible name for the list, when the visual context doesn't give one. */
  label?: string;
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden", className)}>
      <ul aria-label={label} className="-ml-(--sep) flex flex-wrap gap-y-1.5 [--sep:1.75em]">
        {items.map((item) => (
          <li key={item} className="flex whitespace-nowrap">
            <span aria-hidden className="w-(--sep) shrink-0 text-center text-fg-subtle">
              {separator}
            </span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
