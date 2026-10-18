"use client";

import type Lenis from "lenis";
import { useLenis } from "lenis/react";
import { usePathname } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { ScrollLink } from "@/components/ui/scroll-link";
import { useReducedMotion } from "@/hooks/use-media-query";
import { cn } from "@/lib/cn";
import { openCommandMenu, SECTIONS, toggleMobileMenu, type SectionId } from "@/lib/ui-events";
import { LogoLink } from "./logo";
import { MENU_BUTTON_CLASS, MOBILE_MENU_ID, useMobileMenuOpen } from "./mobile-menu";
import { ThemeToggle } from "./theme-toggle";
import { useIsApplePlatform } from "./use-apple-platform";

/** Indexes match the sections' own "(04) Toolkit" eyebrows (and the footer's list). */
const NAV = SECTIONS.map((section, i) => ({ ...section, index: String(i + 1).padStart(2, "0") }));

/**
 * Fixed header: transparent at the top, frosted once scrolled, hides on scroll-down (stays put
 * under reduced motion).
 */
export function Header() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();

  const onScroll = useCallback(
    (lenis: Lenis) => {
      const el = ref.current;
      if (!el) return;
      const y = lenis.scroll;
      el.dataset.scrolled = String(y > 24);
      if (reduce || y < 160 || lenis.direction === -1) el.dataset.hidden = "false";
      else if (lenis.direction === 1 && !el.contains(document.activeElement)) el.dataset.hidden = "true";
    },
    [reduce],
  );
  useLenis(onScroll);

  // Keyboard users must never tab into an off-screen header.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const show = () => {
      el.dataset.hidden = "false";
    };
    el.addEventListener("focusin", show);
    return () => el.removeEventListener("focusin", show);
  }, []);

  return (
    <header
      ref={ref}
      data-hidden="false"
      data-scrolled="false"
      style={{ viewTransitionName: "site-header" }}
      className={cn(
        "group/header fixed inset-x-0 top-0 z-(--z-header)",
        // The frost sits on the header itself: view-transition-name makes the header a backdrop
        // root, so a child's backdrop-filter would only ever blur the (empty) header.
        "transition-[translate,backdrop-filter] duration-300 ease-out data-[scrolled=true]:backdrop-blur-xl",
        // Back quickly on scroll-up (an entrance); off with a short ease-in exit.
        "data-[hidden=true]:-translate-y-full data-[hidden=true]:duration-[250ms] data-[hidden=true]:ease-in",
        "motion-reduce:transition-none",
      )}
    >
      <div
        aria-hidden
        className="absolute inset-0 border-b border-line bg-bg/70 opacity-0 transition-opacity duration-500 group-data-[scrolled=true]/header:opacity-100 motion-reduce:duration-150"
      />
      <div className="container-page relative flex h-(--header-h) items-center justify-between gap-6">
        <LogoLink />

        <nav aria-label="Primary" className="hidden md:block">
          {/* usePathname suspends while dynamic-route shells prerender (cacheComponents). */}
          <Suspense fallback={<NavLinks active={null} />}>
            <TrackedNavLinks />
          </Suspense>
        </nav>

        <div className="flex items-center gap-2">
          <CommandButton />
          <ThemeToggle />
          <MenuButton />
        </div>
      </div>
    </header>
  );
}

function NavLinks({ active }: { active: SectionId | null }) {
  return (
    <ul className="flex items-center gap-6 lg:gap-8">
      {NAV.map((section) => (
        <li key={section.id}>
          <ScrollLink
            to={section.id}
            aria-current={section.id === active ? "location" : undefined}
            className="eyebrow group/link flex h-10 items-center gap-2 text-fg-muted transition-colors duration-300 hover:text-fg aria-[current=location]:text-fg"
          >
            <span className="transition-colors duration-300 group-hover/link:text-accent-ink group-aria-[current=location]/link:text-accent-ink">
              {section.index}
            </span>
            <span className="link-draw group-aria-[current=location]/link:[background-size:100%_1px]">{section.label}</span>
          </ScrollLink>
        </li>
      ))}
    </ul>
  );
}

/**
 * Marks the section crossing the middle of the viewport on the home page; on a case study the
 * "Work" link stays lit, since that is where it lives.
 */
function TrackedNavLinks() {
  const pathname = usePathname();
  const [inView, setInView] = useState<SectionId | null>(null);

  useEffect(() => {
    if (pathname !== "/") return;
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        setInView(SECTIONS.find((section) => visible.has(section.id))?.id ?? null);
      },
      { rootMargin: "-45% 0px -54% 0px" },
    );
    for (const { id } of SECTIONS) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [pathname]);

  const active = pathname === "/" ? inView : pathname.startsWith("/work/") ? "work" : null;
  return <NavLinks active={active} />;
}

/**
 * Mouse/trackpad: a shortcut pill that steps aside on tablet widths so all five sections fit (the
 * shortcut itself always works). Touch: a compact search button that stays from sm up, since it is
 * the only way to the palette (and the accent switch) there, and a key hint means nothing.
 */
function CommandButton() {
  const apple = useIsApplePlatform();
  const key = apple ? "⌘" : "Ctrl";
  return (
    <button
      type="button"
      onClick={openCommandMenu}
      aria-label={`${key} K, open command menu`}
      aria-haspopup="dialog"
      aria-keyshortcuts={apple ? "Meta+K" : "Control+K"}
      className={cn(
        "eyebrow hidden h-10 items-center justify-center gap-1.5 rounded-full border border-line px-4 text-fg-muted transition-colors duration-300 hover:border-line-strong hover:text-fg sm:flex md:hidden lg:flex",
        "pointer-coarse:w-10 pointer-coarse:px-0 pointer-coarse:text-fg md:pointer-coarse:flex",
      )}
    >
      <kbd className="font-mono pointer-coarse:hidden">{key}</kbd>
      <kbd className="font-mono pointer-coarse:hidden">K</kbd>
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        className="hidden size-[18px] pointer-coarse:block"
      >
        <circle cx="11" cy="11" r="6.5" />
        <path d="m20 20-4.4-4.4" />
      </svg>
    </button>
  );
}

function MenuButton() {
  const open = useMobileMenuOpen();
  return (
    <button
      type="button"
      onClick={toggleMobileMenu}
      aria-expanded={open}
      aria-controls={MOBILE_MENU_ID}
      aria-haspopup="dialog"
      className={cn(MENU_BUTTON_CLASS, "md:hidden")}
    >
      {open ? "Close" : "Menu"}
    </button>
  );
}
