"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { onIntroReveal } from "@/lib/intro";

// three.js stays out of the initial bundle and is never prerendered (`ssr: false` must live
// in a client component).
const LatentField = dynamic(() => import("./latent-field").then((mod) => mod.LatentField), {
  ssr: false,
  loading: () => null,
});

/**
 * Evaluating three.js and booting WebGL is one long main-thread task, so it is scheduled around
 * the entrance. First visit: as the preloader curtain starts to lift (the curtains run on the
 * compositor; the count before it would freeze). Repeat visits and returns to "/": once the hero
 * name's rise has had its frames.
 */
const AFTER_REVEAL_MS = 1200;

export function HeroField({ className }: { className?: string }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const { intro, introRevealed } = document.documentElement.dataset;
    const revealed = intro === "skip" || introRevealed === "true";
    let timer = 0;
    const stopReveal = onIntroReveal(() => {
      timer = window.setTimeout(() => setMounted(true), revealed ? AFTER_REVEAL_MS : 0);
    });
    return () => {
      stopReveal();
      window.clearTimeout(timer);
    };
  }, []);

  return mounted ? <LatentField className={className} /> : null;
}
