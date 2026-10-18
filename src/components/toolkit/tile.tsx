import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/cn";

// Both layers read the pointer position from --mx/--my, which BentoGrid sets on the hovered tile.
const SPOTLIGHT: CSSProperties = {
  background: "radial-gradient(34rem circle at var(--mx, 50%) var(--my, 0%), var(--spot), transparent 62%)",
};

// The hairline brightens near the pointer: a smaller gradient masked down to the 1px border ring.
const RIM: CSSProperties = {
  padding: 1,
  background: "radial-gradient(16rem circle at var(--mx, 50%) var(--my, 0%), var(--rim), transparent 70%)",
  mask: "linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0)",
  WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
  WebkitMaskComposite: "xor",
};

/**
 * One bento card: hairline border, elevated surface, mono eyebrow title (h3) and an optional
 * right-aligned meta. Content after the header is laid out in a flex column, so `mt-auto` on a
 * child pins it to the bottom edge.
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
        "group/tile relative isolate flex flex-col gap-8 rounded-card border border-line bg-bg-elevated p-6 transition-colors duration-500 ease-out hover:border-line-strong lg:p-8",
        // An ink haze in both themes: the accent is reserved for actions.
        "[--spot:color-mix(in_oklab,var(--fg)_5%,transparent)] [--rim:color-mix(in_oklab,var(--fg)_30%,transparent)]",
        className,
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 rounded-[inherit] opacity-0 transition-opacity duration-500 ease-out group-hover/tile:opacity-100"
        style={SPOTLIGHT}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -inset-px -z-10 rounded-[inherit] opacity-0 transition-opacity duration-500 ease-out group-hover/tile:opacity-100"
        style={RIM}
      />
      <div className={cn("flex items-center justify-between gap-4", headerClassName)}>
        <h3 className="eyebrow text-fg-muted">{title}</h3>
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
          className="rounded-full border border-line px-3 py-1.5 text-sm text-fg"
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
