import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";

/**
 * A button/link label whose letters roll up on hover and keyboard focus, staggered, each replaced by
 * its own copy from below (styles in globals.css; pure CSS, so it works in server components). The
 * split letters are aria-hidden; assistive tech reads the label from a visually hidden copy.
 */
export function RollText({ children, className }: { children: string; className?: string }) {
  return (
    <span className={cn("relative", className)}>
      <span className="sr-only">{children}</span>
      <span aria-hidden className="roll-chars">
        {Array.from(children).map((char, i) => (
          <span key={i} className="roll-char" style={{ "--i": i } as CSSProperties}>
            {char}
          </span>
        ))}
      </span>
    </span>
  );
}
