"use client";

import "lenis/dist/lenis.css";
import type Lenis from "lenis";
import type { LenisOptions } from "lenis";
import { ReactLenis, useLenis } from "lenis/react";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { findRendered, focusWhenReady, markClientNavigation } from "@/components/a11y/route-focus";
import { gsap, ScrollTrigger } from "@/lib/gsap";

// Module constant: ReactLenis re-creates the instance whenever these serialize differently.
// Anchors are off on purpose — <ScrollLink> owns in-page navigation (one code path).
const OPTIONS: LenisOptions = {
  autoRaf: false,
  lerp: 0.1,
  smoothWheel: true,
  anchors: false,
  allowNestedScroll: true,
  stopInertiaOnNavigate: true,
  respectReducedMotion: true,
};

/** Drives Lenis from GSAP's ticker so smooth scroll and ScrollTrigger share one frame loop. */
function LenisGsapBridge() {
  const lenis = useLenis();

  useEffect(() => {
    if (!lenis) return;
    let active = true;
    const tick = (time: number) => lenis.raf(time * 1000);
    const offScroll = lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    window.__lenis = lenis;
    window.__ScrollTrigger = ScrollTrigger;
    // Web fonts change line heights after the first measure; re-measure so scrubbed
    // timelines stay aligned with the content they track.
    document.fonts.ready.then(() => {
      if (active) ScrollTrigger.refresh();
    });
    return () => {
      active = false;
      offScroll();
      gsap.ticker.remove(tick);
      if (window.__lenis === lenis) delete window.__lenis;
    };
  }, [lenis]);

  return null;
}

/** How long to wait for a hash target that commits after the pathname (~2s). */
const TARGET_WAIT_FRAMES = 120;

function readHash() {
  const raw = window.location.hash.slice(1);
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** Puts `target` (or the page top) at the top of the viewport, instantly. */
function land(lenis: Lenis, target: HTMLElement | null) {
  // Lenis still holds the previous page's limit (scrollTo clamps to it) and offset (a scrollTo
  // matching that stale offset is skipped): re-measure first.
  lenis.resize();
  // Absolute offset, same landing as glideTo — an element target would honour scroll-margin.
  const top = target ? target.getBoundingClientRect().top + window.scrollY : 0;
  lenis.scrollTo(top, { immediate: true, force: true });
}

/**
 * On client navigation, land on the URL's anchor (if any) or the top — instantly, never smoothed —
 * and move focus there. Case studies focus their own title (<FocusOnNavigate>).
 */
function RouteScrollReset() {
  const lenis = useLenis();
  const pathname = usePathname();
  const previousPath = useRef(pathname);
  const arrived = useRef(false);

  // Top first. A layout effect runs once the new page's DOM is in but before its own GSAP setup
  // (layout effects later in the tree), so its ScrollTriggers are created as on a fresh load.
  // Created at a deep offset (the old page's, or the anchor's), a trigger force-refreshes the
  // timeline triggers still waiting for their first tick, and the `once` entrances that fire
  // inside that loop crash ScrollTrigger.
  useLayoutEffect(() => {
    if (!lenis || previousPath.current === pathname) return;
    previousPath.current = pathname;
    arrived.current = true;
    markClientNavigation();
    ScrollTrigger.clearScrollMemory();
    land(lenis, null);
  }, [pathname, lenis]);

  useEffect(() => {
    if (!lenis || !arrived.current) return;
    arrived.current = false;
    // Top again: Next has since scrolled to the anchor in its own layout effect, and in
    // development StrictMode re-runs the new page's effects (re-creating its triggers) right
    // after this one.
    land(lenis, null);

    // Next frame, and once a target that commits late exists: re-measure every trigger — with the
    // old page's scroll memory cleared, so refresh() can't restore it — then land on the anchor.
    const hash = readHash();
    let frame = 0;
    let stopFocus = () => {};
    const settle = (framesLeft: number) => {
      const target = hash ? findRendered(hash) : null;
      if (hash && !target && framesLeft > 0) {
        frame = requestAnimationFrame(() => settle(framesLeft - 1));
        return;
      }
      ScrollTrigger.clearScrollMemory();
      ScrollTrigger.refresh();
      land(lenis, target);
      if (pathname === "/") {
        stopFocus = focusWhenReady(() =>
          target ? (findRendered(`${hash}-title`) ?? target) : findRendered("hero-title"),
        );
      }
    };
    frame = requestAnimationFrame(() => settle(TARGET_WAIT_FRAMES));

    return () => {
      cancelAnimationFrame(frame);
      stopFocus();
    };
  }, [pathname, lenis]);

  return null;
}

export function SmoothScroll({ children }: { children: ReactNode }) {
  return (
    <ReactLenis root options={OPTIONS}>
      <LenisGsapBridge />
      {/* usePathname suspends while dynamic-route shells prerender (cacheComponents). */}
      <Suspense fallback={null}>
        <RouteScrollReset />
      </Suspense>
      {children}
    </ReactLenis>
  );
}
