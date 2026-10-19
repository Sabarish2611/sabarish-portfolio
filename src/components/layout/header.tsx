"use client";

import type Lenis from "lenis";
import { useLenis } from "lenis/react";
import { usePathname } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { ScrollLink } from "@/components/ui/scroll-link";
import { RollText } from "@/components/ui/roll-text";
import { site } from "@/content/site";
import { useReducedMotion } from "@/hooks/use-media-query";
import { cn } from "@/lib/cn";
import { openCommandMenu, SECTIONS, toggleMobileMenu, type SectionId } from "@/lib/ui-events";
import { DROPPED, INITIAL, LogoLink } from "./logo";
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
  const progress = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  // How far the page scrolls before the header may hide. Measured once, and again whenever the page's
  // height changes (resizes, navigations): reading layout on every scroll frame can force a reflow.
  const keepUntil = useRef<number | null>(null);

  useEffect(() => {
    const observer = new ResizeObserver(() => {
      keepUntil.current = null;
    });
    observer.observe(document.body);
    return () => observer.disconnect();
  }, []);

  const onScroll = useCallback(
    (lenis: Lenis) => {
      const el = ref.current;
      if (!el) return;
      const y = lenis.scroll;
      el.dataset.scrolled = String(y > 24);
      if (keepUntil.current === null) {
        // On the home page the header stays until the hero has scrolled away: the name docks into it.
        // offsetParent is null while Next keeps "/" in the document, hidden, under another page.
        const hero = document.getElementById("hero");
        keepUntil.current = hero?.offsetParent ? hero.offsetTop + hero.offsetHeight : 160;
      }
      // Reading progress for the hairline along the header's bottom edge: written straight to the
      // bar's transform, so each scroll frame restyles one element, not the header's whole subtree.
      if (progress.current) {
        progress.current.style.transform = `scaleX(${Number.isFinite(lenis.progress) ? lenis.progress : 0})`;
      }
      if (reduce || y < keepUntil.current || lenis.direction === -1) el.dataset.hidden = "false";
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
        // text-fg here (not just inherited from <body>): over the accent finale the header re-maps its
        // tokens, and only a colour declared on the header itself picks that up.
        "group/header fixed inset-x-0 top-0 z-(--z-header) text-fg",
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
      {/* How far down the page you are: an accent hairline over the header's bottom border. */}
      <div
        ref={progress}
        aria-hidden
        // The scroll handler owns `transform`; a Tailwind scale-x-* (the separate `scale` property)
        // would multiply with it.
        style={{ transform: "scaleX(0)" }}
        className="absolute inset-x-0 bottom-0 h-px origin-left bg-accent-ink opacity-0 transition-opacity duration-500 group-data-[scrolled=true]/header:opacity-100"
      />
      {/* The flying copy of the hero name, driven by sections/hero.tsx (fixed within the header, so it
          paints above the frost like the logo it lands on). It contracts as it flies: the dropped
          letters sink into their masks, then the initial slides over to meet the first name. */}
      <span
        data-dock
        aria-hidden
        className="pointer-events-none invisible fixed top-0 left-0 origin-top-left font-serif leading-[0.84] tracking-[-0.035em] whitespace-nowrap [font-kerning:none] will-change-transform"
      >
        {site.shortName}
        {Array.from(DROPPED, (letter, i) => (
          <span key={i} className="-mx-[0.05em] -my-[0.12em] inline-block overflow-clip px-[0.05em] py-[0.12em]">
            <span data-dock-dropped className="inline-block">
              {letter}
            </span>
          </span>
        ))}
        {" "}
        <span data-dock-initial className="inline-block">
          {INITIAL}
        </span>
      </span>
      <div className="container-page relative flex h-(--header-h) items-center justify-between gap-3 sm:gap-6">
        <div className="flex items-center gap-4">
          {/* On the home page the hero's name docks into this logo as you scroll (sections/hero.tsx).
              Never squeezed: a wrapped wordmark would also throw off where the name lands. */}
          <div data-header-logo className="shrink-0">
            <LogoLink />
          </div>
          {/* Phones have no section nav: a "02 / 05" counter stands in for it. */}
          <Suspense fallback={null}>
            <SectionCounter />
          </Suspense>
        </div>

        <nav aria-label="Primary" className="hidden md:block">
          {/* usePathname suspends while dynamic-route shells prerender (cacheComponents). */}
          <Suspense fallback={<NavLinks active={null} />}>
            <TrackedNavLinks />
          </Suspense>
        </nav>

        <Suspense fallback={null}>
          <AccentWatcher header={ref} />
        </Suspense>

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
    <ul className="flex items-center gap-5 lg:gap-8">
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
            <span className="link-draw group-aria-[current=location]/link:[background-size:100%_1px]">
              <RollText>{section.label}</RollText>
            </span>
          </ScrollLink>
        </li>
      ))}
    </ul>
  );
}

/**
 * The section crossing the middle of the viewport on the home page; on a case study, "work", since
 * that is where it lives.
 */
function useActiveSection() {
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

  return pathname === "/" ? inView : pathname.startsWith("/work/") ? "work" : null;
}

/**
 * Over a section painted in the accent (the contact finale), the header takes the same theme:
 * data-theme="accent" on the header re-maps its tokens, so text, frost and hairlines follow.
 */
function AccentWatcher({ header }: { header: RefObject<HTMLElement | null> }) {
  const pathname = usePathname();

  useEffect(() => {
    const el = header.current;
    const sections = document.querySelectorAll<HTMLElement>("main [data-theme='accent']");
    if (!el || sections.length === 0) return;
    const over = new Set<Element>();
    let observer: IntersectionObserver | null = null;
    const observe = () => {
      observer?.disconnect();
      // A band as tall as the header along the top of the viewport.
      const band = window.innerHeight - el.offsetHeight;
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) over.add(entry.target);
            else over.delete(entry.target);
          }
          if (over.size) el.dataset.theme = "accent";
          else delete el.dataset.theme;
        },
        { rootMargin: `0px 0px -${Math.max(0, band)}px 0px` },
      );
      sections.forEach((section) => observer?.observe(section));
    };
    observe();
    window.addEventListener("resize", observe);
    return () => {
      window.removeEventListener("resize", observe);
      observer?.disconnect();
      delete el.dataset.theme;
    };
  }, [header, pathname]);

  return null;
}

function TrackedNavLinks() {
  return <NavLinks active={useActiveSection()} />;
}

function SectionCounter() {
  const active = useActiveSection();
  const section = NAV.find((item) => item.id === active);
  return (
    <p
      aria-hidden
      className={cn(
        // Steps aside on the narrowest phones (under 23rem), where it would crowd the logo.
        "eyebrow whitespace-nowrap text-fg-subtle transition-opacity duration-300 max-[23rem]:hidden md:hidden",
        section ? "opacity-100" : "opacity-0",
      )}
    >
      <span className="text-accent-ink">{section?.index ?? "00"}</span> / {String(NAV.length).padStart(2, "0")}
    </p>
  );
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
        "eyebrow hidden h-10 items-center justify-center gap-1.5 chamfer-outline px-4 text-fg-muted transition-colors duration-300 [--outline:var(--line)] hover:text-fg hover:[--outline:var(--line-strong)] sm:flex md:hidden lg:flex",
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
