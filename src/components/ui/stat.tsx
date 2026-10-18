import { cn } from "@/lib/cn";

/**
 * Stat tile, per the data-viz rules: value in the sans face (semibold, proportional figures) in
 * ink colour — the accent is only the small mark — and a sentence-case label.
 * Render inside a <dl>.
 */
export function Stat({
  value,
  label,
  size = "stat",
  className,
}: {
  value: string;
  label: string;
  /** "figure" is the single hero-sized number allowed per view. */
  size?: "stat" | "figure";
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <dt className="order-2 text-sm text-fg-muted">{label}</dt>
      <dd
        className={cn(
          // Never wraps: a value is one token ("384-d" must not break at its hyphen); layouts give it room.
          "order-1 flex items-center gap-3 font-sans font-semibold whitespace-nowrap text-fg",
          size === "figure" ? "text-figure" : "text-stat",
        )}
      >
        <span aria-hidden className="size-2 shrink-0 rounded-[2px] bg-accent-ink" />
        {value}
      </dd>
    </div>
  );
}
