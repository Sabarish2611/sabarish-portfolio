"use client";

import { useLenis } from "lenis/react";
import { usePathname } from "next/navigation";
import {
  Suspense,
  useEffect,
  useRef,
  useSyncExternalStore,
  type MouseEvent,
  type ReactNode,
  type SyntheticEvent,
  type UIEvent,
} from "react";
import { ScrollLink } from "@/components/ui/scroll-link";
import { site } from "@/content/site";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useAccent } from "@/hooks/use-preferences";
import { cn } from "@/lib/cn";
import { focusSection } from "@/lib/focus-section";
import { EASE, gsap, useGSAP } from "@/lib/gsap";
import { ACCENTS, setAccent, type Accent } from "@/lib/preferences";
import { SECTIONS, UI_EVENTS, type SectionId } from "@/lib/ui-events";
import { LogoLink } from "./logo";
import { ThemeToggle } from "./theme-toggle";

export const MOBILE_MENU_ID = "mobile-menu";

/**
 * Shared by the header's Menu button and the overlay's Close button, which sits exactly on top of it.
 * The ::after is an invisible 44px hit area around the 40px button (::before paints the outline).
 */
export const MENU_BUTTON_CLASS =
  "eyebrow flex h-10 min-w-[5.25rem] shrink-0 chamfer-outline items-center justify-center px-3 [--outline:var(--line)] after:absolute after:-inset-0.5";

/** Raw swatch colours: `--accent` only ever holds the active one. */
export const ACCENT_SWATCHES: Record<Accent, { label: string; hex: string }> = {
  lime: { label: "Lime", hex: "#c6f432" },
  orange: { label: "Orange", hex: "#ff5b1f" },
};

// Tiny external store. `open` is the intent (header button label, aria-expanded); `shown` stays true
// through the exit animation, while the top-layer overlay covers the page (the cursor steps aside).
const store = { open: false, shown: false, instant: false };
const listeners = new Set<() => void>();

function update(patch: Partial<typeof store>) {
  Object.assign(store, patch);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const useMobileMenuOpen = () => useSyncExternalStore(subscribe, () => store.open, () => false);
export const useMobileMenuShown = () => useSyncExternalStore(subscribe, () => store.shown, () => false);

/** `instant` skips the exit animation (another overlay is taking over, or the layout went wide). */
export function closeMobileMenu({ instant = false } = {}) {
  if (store.open) update({ open: false, instant });
}

const pad = (n: number) => String(n).padStart(2, "0");

function parts(dialog: HTMLDialogElement) {
  const q = gsap.utils.selector(dialog);
  return {
    curtain: q("[data-menu-curtain]"),
    bar: q("[data-menu-bar]"),
    menuLabel: q("[data-menu-label='menu']"),
    closeLabel: q("[data-menu-label='close']"),
    words: q("[data-menu-word]"),
    rules: q("[data-menu-rule]"),
    fades: q("[data-menu-fade]"),
  };
}

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Curtain drops, rules draw, the links rise out of their masks. `fresh` = the dialog was closed. */
function playOpen(dialog: HTMLDialogElement, fresh: boolean) {
  const p = parts(dialog);
  if (reducedMotion()) {
    gsap.set([...p.curtain, ...p.words, ...p.closeLabel], { yPercent: 0 });
    gsap.set(p.menuLabel, { yPercent: -110 });
    gsap.set(p.rules, { scaleX: 1 });
    gsap.set([...p.fades, ...p.bar], { opacity: 1, y: 0 });
    return gsap.fromTo(dialog, { opacity: fresh ? 0 : gsap.getProperty(dialog, "opacity") }, { opacity: 1, duration: 0.2, ease: "none" });
  }
  if (fresh) {
    gsap.set([dialog, ...p.bar], { opacity: 1 });
    gsap.set(p.curtain, { yPercent: -100 });
    gsap.set(p.menuLabel, { yPercent: 0 });
    gsap.set([...p.words, ...p.closeLabel], { yPercent: 110 });
    gsap.set(p.rules, { scaleX: 0, transformOrigin: "0% 50%" });
    gsap.set(p.fades, { opacity: 0, y: 14 });
  }
  return gsap
    .timeline({ defaults: { ease: EASE.out } })
    .to(p.curtain, { yPercent: 0, duration: 0.8, ease: EASE.inOut }, 0)
    .to(p.bar, { opacity: 1, duration: 0.2 }, 0)
    .to(p.menuLabel, { yPercent: -110, duration: 0.5, ease: EASE.inOut }, 0.05)
    .to(p.closeLabel, { yPercent: 0, duration: 0.5, ease: EASE.inOut }, 0.12)
    .to(p.rules, { scaleX: 1, transformOrigin: "0% 50%", duration: 1, stagger: 0.05 }, 0.38)
    .to(p.words, { yPercent: 0, duration: 1.05, stagger: 0.06 }, 0.42)
    .to(p.fades, { opacity: 1, y: 0, duration: 0.8, stagger: 0.035 }, 0.55);
}

/**
 * Content sinks away, the curtain lifts. The bar normally fades last, handing over to the identical
 * header underneath; after a link it leaves with the content, as the page glides and the header slides off.
 */
function playClose(dialog: HTMLDialogElement, onComplete: () => void, navigating: boolean) {
  const p = parts(dialog);
  if (reducedMotion()) return gsap.to(dialog, { opacity: 0, duration: 0.15, ease: "none", onComplete });
  return gsap
    .timeline({ defaults: { ease: EASE.in }, onComplete })
    .to(p.words, { yPercent: -110, duration: 0.4, stagger: 0.025 }, 0)
    .to(p.fades, { opacity: 0, duration: 0.25 }, 0)
    .to(p.rules, { scaleX: 0, transformOrigin: "100% 50%", duration: 0.45, ease: EASE.inOut }, 0)
    .to(p.closeLabel, { yPercent: 110, duration: 0.45, ease: EASE.inOut }, 0.1)
    .to(p.menuLabel, { yPercent: 0, duration: 0.45, ease: EASE.inOut }, 0.16)
    .to(p.curtain, { yPercent: -100, duration: 0.65, ease: EASE.inOut }, 0.15)
    .to(p.bar, { opacity: 0, duration: navigating ? 0.3 : 0.2, ease: "none" }, navigating ? 0.05 : 0.72);
}

/** Full-screen navigation below md: a native modal <dialog> (focus trap, Escape, top layer). */
export function MobileMenu() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const animation = useRef<gsap.core.Animation | null>(null);
  const navigating = useRef(false);
  /** The section an in-page link is gliding to: it gets focus once the dialog has closed. */
  const focusOnClose = useRef<SectionId | null>(null);
  const open = useMobileMenuOpen();
  const lenis = useLenis();
  const wide = useMediaQuery("(min-width: 48rem)");

  useEffect(() => {
    const toggle = () => update({ open: !store.open, instant: false });
    window.addEventListener(UI_EVENTS.toggleMobileMenu, toggle);
    return () => window.removeEventListener(UI_EVENTS.toggleMobileMenu, toggle);
  }, []);

  // From md up the header carries the full nav, so the overlay never outlives a resize.
  useEffect(() => {
    if (wide) closeMobileMenu({ instant: true });
  }, [wide]);

  useEffect(() => {
    if (!open || !lenis) return;
    lenis.stop();
    return () => lenis.start();
  }, [open, lenis]);

  useGSAP(
    () => {
      const dialog = dialogRef.current;
      if (!dialog) return;
      animation.current?.kill();
      if (open) {
        focusOnClose.current = null; // reopened mid-exit: that link's hand-off no longer applies
        const fresh = !dialog.open;
        if (fresh) {
          dialog.showModal();
          dialog.scrollTop = 0;
          dialog.dataset.scrolled = "false";
          update({ shown: true });
        }
        closeRef.current?.focus();
        animation.current = playOpen(dialog, fresh);
      } else if (dialog.open) {
        if (store.instant) dialog.close();
        else animation.current = playClose(dialog, () => dialog.close(), navigating.current);
      }
      navigating.current = false;
    },
    { scope: dialogRef, dependencies: [open] },
  );

  // Fires for our own close() and when the browser closes the dialog itself.
  function handleClose() {
    animation.current?.kill();
    update({ open: false, shown: false, instant: false });
    // Native close has just handed focus back to the Menu button; carry it on to the section the
    // page is gliding to, so the next Tab continues from there (and screen readers hear where).
    const id = focusOnClose.current;
    focusOnClose.current = null;
    if (id) focusSection(id);
  }

  // Escape: animate out instead of vanishing.
  function handleCancel(event: SyntheticEvent<HTMLDialogElement>) {
    event.preventDefault();
    closeMobileMenu();
  }

  function handleNavigate(event: MouseEvent<HTMLAnchorElement>, id: SectionId) {
    navigating.current = true;
    // Only for a plain click on the home page: elsewhere this is a route change, and the home page
    // places focus itself on arrival.
    const plain = event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
    if (plain && window.location.pathname === "/") focusOnClose.current = id;
    // ScrollLink glides right after this handler, and a stopped Lenis ignores scrollTo.
    lenis?.start();
    closeMobileMenu();
  }

  // Once the links scroll (short landscape screens), the bar turns opaque so they pass beneath it.
  function handleScroll(event: UIEvent<HTMLDialogElement>) {
    const dialog = event.currentTarget;
    dialog.dataset.scrolled = String(dialog.scrollTop > 0);
  }

  return (
    <dialog
      ref={dialogRef}
      id={MOBILE_MENU_ID}
      aria-label="Site menu"
      onCancel={handleCancel}
      onClose={handleClose}
      onScroll={handleScroll}
      data-lenis-prevent
      className="group/menu fixed inset-0 z-(--z-menu) m-0 h-dvh max-h-none w-full max-w-none overflow-x-hidden overflow-y-auto overscroll-contain bg-transparent p-0 text-fg backdrop:bg-transparent"
    >
      <div data-menu-curtain aria-hidden className="fixed inset-0 bg-bg" />

      <div className="relative flex min-h-full flex-col">
        {/* Mirrors the header row exactly, so the logo stays put and "Menu" rolls into "Close". Pinned,
            so Close is always in reach; opaque only once the content scrolls beneath it. */}
        <div
          data-menu-bar
          className="container-page sticky top-0 z-10 flex h-(--header-h) shrink-0 items-center justify-between gap-6 group-data-[scrolled=true]/menu:bg-bg group-data-[scrolled=true]/menu:shadow-[0_1px_0_0_var(--line)]"
        >
          <LogoLink onClick={() => closeMobileMenu()} />
          <button
            ref={closeRef}
            type="button"
            onClick={() => closeMobileMenu()}
            aria-label="Close menu"
            className={cn(MENU_BUTTON_CLASS, "bg-bg")}
          >
            <span aria-hidden className="grid overflow-hidden">
              <span data-menu-label="menu" className="col-start-1 row-start-1 text-center">
                Menu
              </span>
              <span data-menu-label="close" className="col-start-1 row-start-1 text-center">
                Close
              </span>
            </span>
          </button>
        </div>

        <nav aria-label="Sections" className="container-page mt-[clamp(0.75rem,4vh,2.5rem)]">
          <span data-menu-rule aria-hidden className="block h-px origin-left bg-line" />
          <ul>
            {SECTIONS.map((section, i) => (
              <li key={section.id} className="relative">
                <ScrollLink
                  to={section.id}
                  onClick={(event) => handleNavigate(event, section.id)}
                  className="group flex items-center gap-4 py-3.5 [@media(max-height:30rem)]:py-2"
                >
                  <span
                    data-menu-fade
                    className="eyebrow w-7 shrink-0 self-start pt-[0.45em] text-fg-muted transition-colors duration-300 group-hover:text-accent-ink"
                  >
                    {pad(i + 1)}
                  </span>
                  <span className="reveal-line-mask block flex-1 overflow-hidden">
                    {/* The display size, also capped by height so landscape phones keep the list compact. */}
                    <span
                      data-menu-word
                      className="block font-serif text-[length:clamp(2.75rem,min(1.1rem+6.6vw,11svh),8.5rem)] leading-(--text-display--line-height) tracking-(--text-display--letter-spacing)"
                    >
                      {section.label}
                    </span>
                  </span>
                  <span
                    data-menu-fade
                    aria-hidden
                    className="text-xl text-fg-subtle transition-[translate,color] duration-500 ease-out group-hover:translate-x-1 group-hover:text-fg"
                  >
                    →
                  </span>
                </ScrollLink>
                <span data-menu-rule aria-hidden className="absolute inset-x-0 bottom-0 h-px origin-left bg-line" />
              </li>
            ))}
          </ul>
        </nav>

        <MenuFooter />
      </div>

      {/* usePathname suspends while dynamic-route shells prerender (cacheComponents). */}
      <Suspense fallback={null}>
        <CloseOnNavigate />
      </Suspense>
    </dialog>
  );
}

function MenuFooter() {
  const accent = useAccent();
  return (
    <div className="container-page mt-auto pt-10 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div data-menu-fade>
        <p className="eyebrow text-fg-muted">Get in touch</p>
        {/* Padded to a tap target without moving anything (the underline stays at the text); the
            ::after stretches the hit area to 44px. */}
        <a
          href={`mailto:${site.email}`}
          className="link-draw relative -mb-2 inline-block bg-origin-content py-2 text-lead after:absolute after:inset-x-0 after:top-1/2 after:h-11 after:-translate-y-1/2"
        >
          {site.email}
        </a>
      </div>
      <ul data-menu-fade className="eyebrow mt-3 flex gap-6">
        <li>
          <ExternalLink href={site.links.linkedin}>LinkedIn</ExternalLink>
        </li>
        <li>
          <ExternalLink href={site.links.resume}>Résumé</ExternalLink>
        </li>
      </ul>

      <span data-menu-rule aria-hidden className="mt-5 block h-px origin-left bg-line" />
      <div className="flex items-center justify-between gap-4 pt-4">
        <div data-menu-fade className="flex items-center gap-3">
          <span aria-hidden className="eyebrow text-fg-muted">
            Theme
          </span>
          <ThemeToggle />
        </div>
        <div data-menu-fade role="group" aria-label="Accent color" className="flex items-center gap-1.5">
          <span aria-hidden className="eyebrow mr-1.5 text-fg-muted">
            Accent
          </span>
          {ACCENTS.map((option) => (
            <Swatch key={option} accent={option} active={option === accent} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="group relative inline-flex h-10 items-center gap-2 after:absolute after:-inset-y-0.5 after:inset-x-0">
      <span className="link-draw">{children}</span>
      <span
        aria-hidden
        className="text-fg-muted transition-[translate,color] duration-500 ease-out group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-accent-ink"
      >
        ↗
      </span>
      <span className="sr-only">(opens in new tab)</span>
    </a>
  );
}

function Swatch({ accent, active }: { accent: Accent; active: boolean }) {
  const { label, hex } = ACCENT_SWATCHES[accent];

  function select(event: MouseEvent<HTMLButtonElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    setAccent(accent, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
  }

  return (
    <button
      type="button"
      onClick={select}
      aria-pressed={active}
      aria-label={`${label} accent`}
      className="grid size-10 chamfer-outline place-items-center [--cut:0.4rem] after:absolute after:-inset-0.5 [--outline:var(--line)] hover:[--outline:var(--line-strong)] aria-pressed:[--outline:var(--fg)]"
    >
      <span className="size-4 rounded-full ring-1 ring-black/15 ring-inset" style={{ backgroundColor: hex }} />
    </button>
  );
}

/** Any navigation (back/forward included) dismisses the overlay. */
function CloseOnNavigate() {
  const pathname = usePathname();
  useEffect(() => {
    closeMobileMenu();
  }, [pathname]);
  return null;
}
