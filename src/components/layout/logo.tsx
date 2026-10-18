import Link from "next/link";
import type { MouseEventHandler } from "react";
import { site } from "@/content/site";

/**
 * The wordmark link home, shared by the header and the mobile menu's bar (which must line up with
 * it exactly). "Sabarish." on screen, "Sabarish — home" for assistive tech: the visible word leads
 * the accessible name, so speech input can target it. 40px tall for touch.
 */
export function LogoLink({ onClick }: { onClick?: MouseEventHandler<HTMLAnchorElement> }) {
  return (
    <Link href="/" onClick={onClick} className="inline-flex h-10 items-center font-serif text-[1.7rem] leading-none tracking-tight">
      {site.shortName}
      <span aria-hidden className="text-accent-ink">
        .
      </span>
      <span className="sr-only"> — home</span>
    </Link>
  );
}
