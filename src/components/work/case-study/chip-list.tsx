import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

type ChipListProps = Omit<ComponentProps<"ul">, "children"> & {
  items: readonly string[];
  /** "strong" for the hero's domains; "muted" for long lists such as the stack. */
  tone?: "strong" | "muted";
};

/** Non-interactive pills (mono label style). Data attributes pass through for the motion layer. */
export function ChipList({ items, tone = "muted", className, ...rest }: ChipListProps) {
  return (
    <ul className={cn("flex flex-wrap gap-2", className)} {...rest}>
      {items.map((item) => (
        <li
          key={item}
          className={cn(
            "eyebrow rounded-full border px-3.5 py-2",
            tone === "strong" ? "border-line-strong text-fg" : "border-line text-fg-muted",
          )}
        >
          {item}
        </li>
      ))}
    </ul>
  );
}
