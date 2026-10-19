import type { ReactNode } from "react";
import { RevealText } from "@/components/ui/reveal-text";
import { SignalTrace } from "./signal-trace";

/** Pill CTAs, matching the hero's. */
export const PILL_PRIMARY =
  "group inline-flex h-12 chamfer-fill items-center gap-3 px-6 font-medium text-on-accent [--cut:0.625rem]";
export const PILL_SECONDARY =
  "group inline-flex h-12 chamfer-outline items-center gap-3 px-6 text-fg [--cut:0.625rem] hover:[--outline:var(--fg)]";

const HEADING =
  "mt-8 -ml-[0.04em] font-serif text-[length:clamp(3.75rem,1rem+12vw,12.5rem)] leading-[0.9] tracking-[-0.035em] md:mt-10";

/**
 * Editorial layout shared by the 404 and error pages: eyebrow, huge serif statement, the
 * flatlining signal trace, then copy + actions (left) and an optional aside (right).
 */
export function SystemPage({
  eyebrow,
  title,
  lead,
  actions,
  aside,
  animate = true,
}: {
  eyebrow: string;
  title: ReactNode;
  lead: ReactNode;
  actions: ReactNode;
  aside?: ReactNode;
  /** Error boundaries skip entrance motion: the fallback should depend on as little as possible. */
  animate?: boolean;
}) {
  return (
    <main
      id="main"
      className="container-page section-pad flex min-h-svh flex-col justify-center pt-[max(var(--section-pad),calc(var(--header-h)+3rem))]"
    >
      <p className="eyebrow flex items-center gap-3 text-fg-muted">
        {/* A hollow ring: the hero's live dot, with the signal gone. */}
        <span aria-hidden className="size-2 rounded-full border border-accent-ink" />
        {eyebrow}
      </p>
      {animate ? (
        <RevealText as="h1" className={HEADING}>
          {title}
        </RevealText>
      ) : (
        <h1 className={HEADING}>{title}</h1>
      )}

      <SignalTrace animate={animate} className="mt-10 md:mt-14" />

      <div className="mt-10 grid grid-cols-12 gap-x-6 gap-y-16 md:mt-14">
        <div className="col-span-12 md:col-span-6 lg:col-span-5">
          <div className="max-w-[34ch] text-lead text-fg-muted">{lead}</div>
          <div className="mt-10 flex flex-wrap items-center gap-3">{actions}</div>
        </div>
        {aside ? <div className="col-span-12 md:col-span-6 lg:col-span-5 lg:col-start-8">{aside}</div> : null}
      </div>
    </main>
  );
}
