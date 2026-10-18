"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { onIntroReveal } from "@/lib/intro";
import { UI_EVENTS } from "@/lib/ui-events";
import { closeMobileMenu } from "./mobile-menu";

// cmdk + Radix Dialog stay out of every page's first-load JS: the palette is fetched once the page
// has settled, or on first use, whichever comes first.
const CommandMenu = dynamic(() => import("./command-menu").then((mod) => mod.CommandMenu), { ssr: false });

/** After the intro has played out, so parsing the chunk never lands on the hero's entrance. */
const WARM_UP_DELAY_MS = 2500;

function whenIdle(callback: () => void) {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(callback, { timeout: 2000 });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(callback, 0);
  return () => window.clearTimeout(id);
}

/** Always mounted and tiny: owns the open state, the ⌘K / Ctrl+K shortcut and the open event. */
export function CommandMenuLauncher() {
  const [open, setOpen] = useState(false); // must start closed: the dialog is client-only
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key?.toLowerCase() !== "k" || !(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return;
      event.preventDefault();
      if (event.repeat) return;
      closeMobileMenu({ instant: true });
      setLoaded(true);
      setOpen((value) => !value);
    }
    function onOpenRequest() {
      closeMobileMenu({ instant: true });
      setLoaded(true);
      setOpen(true);
    }
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener(UI_EVENTS.openCommandMenu, onOpenRequest);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(UI_EVENTS.openCommandMenu, onOpenRequest);
    };
  }, []);

  // Warm up in the background so the first ⌘K opens instantly.
  useEffect(() => {
    let timer: number | undefined;
    let cancelIdle = () => {};
    const unsubscribe = onIntroReveal(() => {
      timer = window.setTimeout(() => {
        cancelIdle = whenIdle(() => setLoaded(true));
      }, WARM_UP_DELAY_MS);
    });
    return () => {
      unsubscribe();
      window.clearTimeout(timer);
      cancelIdle();
    };
  }, []);

  return loaded ? <CommandMenu open={open} onOpenChange={setOpen} /> : null;
}
