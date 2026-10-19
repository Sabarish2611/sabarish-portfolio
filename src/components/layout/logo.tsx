import Link from "next/link";
import type { MouseEventHandler } from "react";
import { site } from "@/content/site";

/** The initial of the full name ("G" of "Sabarishwaran G"). */
export const INITIAL = site.name.slice(site.name.lastIndexOf(" ") + 1);

/** The wordmark: the hero's name contracted to first name and initial, "Sabarish G". */
export const WORDMARK = `${site.shortName} ${INITIAL}`;

/** What the contraction drops from the full name's first word ("waran" of "Sabarishwaran"). */
export const DROPPED = site.name.slice(site.shortName.length, site.name.lastIndexOf(" "));

// The dock (sections/hero.tsx) contracts "<first name> <initial>" to "<shortName> <initial>": fail the
// build, rather than mangle the logo, if the name stops having that shape.
if (!/^\S+ \S$/u.test(site.name) || !site.name.startsWith(site.shortName)) {
  throw new Error('site.name must read "<first name> <one-letter initial>" and start with site.shortName');
}

/**
 * The wordmark link home, shared by the header and the mobile menu's bar (which must line up with
 * it exactly). "Sabarish G." on screen, "Sabarish G — home" for assistive tech: the visible words
 * lead the accessible name, so speech input can target them. 40px tall for touch. Tracked like the
 * hero name (-0.035em), so the name's flying copy (sections/hero.tsx) lands on it exactly.
 */
export function LogoLink({ onClick }: { onClick?: MouseEventHandler<HTMLAnchorElement> }) {
  return (
    <Link
      href="/"
      onClick={onClick}
      className="inline-flex h-10 items-center font-serif text-[1.7rem] leading-none tracking-[-0.035em] whitespace-nowrap"
    >
      {WORDMARK}
      <span aria-hidden className="text-accent-ink">
        .
      </span>
      <span className="sr-only"> — home</span>
    </Link>
  );
}
