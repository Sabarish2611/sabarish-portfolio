import { TOOL_ICONS } from "@/content/tool-icons";
import { cn } from "@/lib/cn";

/**
 * Marks for the ways to reach Sabarish, 24×24 single paths in currentColor: LinkedIn's and GitHub's
 * brand marks (Simple Icons, CC0; the marks remain their owners' trademarks) and the résumé as a page
 * with a cut corner, like the site's cards, and three lines of text. `inset` pads a mark's view box so
 * the marks look the same size side by side: LinkedIn's solid square reads larger than GitHub's circle.
 */
const MARKS = {
  linkedin: {
    inset: 1.75,
    path: "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z",
  },
  github: { inset: 0, path: TOOL_ICONS.github.path },
  resume: { inset: 0, path: "M3.5.5h12l5 5v18h-17zM7 7.5v2h10v-2zm0 4v2h10v-2zm0 4v2h6.5v-2z" },
} as const;

export type ChannelMarkName = keyof typeof MARKS;

export function ChannelMark({ name, className }: { name: ChannelMarkName; className?: string }) {
  const { inset, path } = MARKS[name];
  return (
    <svg
      aria-hidden
      viewBox={`${-inset} ${-inset} ${24 + 2 * inset} ${24 + 2 * inset}`}
      fill="currentColor"
      className={cn("shrink-0", className)}
    >
      <path d={path} />
    </svg>
  );
}
