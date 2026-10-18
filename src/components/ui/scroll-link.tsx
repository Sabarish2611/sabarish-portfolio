"use client";

import { useLenis } from "lenis/react";
import Link from "next/link";
import type { ComponentProps, MouseEvent } from "react";
import { focusSection } from "@/lib/focus-section";
import { glideTo } from "@/lib/glide";
import type { SectionId } from "@/lib/ui-events";

type ScrollLinkProps = Omit<ComponentProps<typeof Link>, "href"> & {
  /** Section id on the home page. */
  to: SectionId;
};

/**
 * In-page section link. On the home page it glides there and moves focus to the section heading;
 * anywhere else it is a normal navigation to `/#id` (RouteScrollReset then lands on the anchor).
 */
export function ScrollLink({ to, onClick, children, ...rest }: ScrollLinkProps) {
  const lenis = useLenis();

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (window.location.pathname !== "/") return;
    const target = document.getElementById(to);
    if (!target) return;
    event.preventDefault();
    glideTo(lenis, target);
    // Focus travels with the view (without scrolling), or the next Tab would jump back here.
    focusSection(to);
    window.history.replaceState(null, "", `#${to}`);
  }

  return (
    <Link href={`/#${to}`} onClick={handleClick} {...rest}>
      {children}
    </Link>
  );
}
