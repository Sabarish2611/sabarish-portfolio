"use client";

import { useRef } from "react";
import { Magnetic } from "@/components/ui/magnetic";
import { ScrollLink } from "@/components/ui/scroll-link";
import { HeroField } from "@/components/webgl/hero-field";
import { projects } from "@/content/projects";
import { experience, site } from "@/content/site";
import { DURATION, EASE, gsap, ScrollTrigger, SplitText, useGSAP } from "@/lib/gsap";
import { onIntroReveal } from "@/lib/intro";

/** Proof on the first screen: the lead project's headline metric. */
const HEADLINE = projects[0].metrics[0];

// No-break spaces: the meta values wrap as "Trellix — / since 2023", never orphaning "2023" or "F1".
const SINCE = `${site.company}\u00A0— since\u00A0${experience[0].startISO.slice(0, 4)}`;
const HEADLINE_RESULT = `${HEADLINE.value} ${HEADLINE.label.replace(/ (?=\S+$)/, "\u00A0")}`;

/**
 * Intro timeline offsets (s). The copy fades in first: the lead paragraph is the LCP element. On a
 * first visit the intro starts as the preloader curtain begins to lift, so the name waits until
 * the curtain clears the bottom of the screen, where it sits.
 */
const FADES_AT = 0.05;
const NAME_AT_UNDER_CURTAIN = 0.3;

/** A longer frame (hydration, WebGL booting) advances the intro by a single 60fps frame. */
const MAX_FRAME_MS = 100;

/** Runs `callback` once the main thread is free, or after `timeout` ms at the latest. */
function whenIdle(callback: () => void, timeout: number) {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(callback, { timeout });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(callback, 120);
  return () => window.clearTimeout(id);
}

/*
 * Short viewports (under 36rem tall: landscape phones, 320×568) get a compact hero, so the name
 * stays above the fold: the eyebrow and meta row drop out, the top tightens, the lead runs wider
 * (fewer lines) and the name is capped by height as well as width. Tailwind variants:
 * [@media(max-height:36rem)]:…
 */

export function Hero() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const section = root.current;
      if (!section) return;
      const name = section.querySelector<HTMLElement>("[data-hero-name]");
      const fades = section.querySelectorAll<HTMLElement>("[data-hero-fade]");
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set([name, ...fades], { autoAlpha: 1 });
      });

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        if (!name) return;
        // First visit: the preloader still covers the page and reveals it later.
        const { intro: introMode, introRevealed } = document.documentElement.dataset;
        const underCurtain = introMode !== "skip" && introRevealed !== "true";
        const split = SplitText.create(name, { type: "chars", mask: "chars", charsClass: "hero-char" });
        // The from() tweens hold their targets hidden until they start: no flash of finished copy.
        const intro = gsap
          .timeline({ paused: true, defaults: { ease: EASE.out } })
          .set(name, { autoAlpha: 1 })
          .from(split.chars, { yPercent: 118, duration: 1.5, stagger: 0.045 }, underCurtain ? NAME_AT_UNDER_CURTAIN : 0)
          .from(fades, { y: 28, autoAlpha: 0, duration: DURATION.slow, stagger: 0.08 }, FADES_AT);

        // Leaving the hero: the name sinks slower than the page, the copy lifts away.
        gsap.to("[data-hero-name-wrap]", {
          yPercent: 28,
          ease: "none",
          scrollTrigger: { trigger: section, start: "top top", end: "bottom top", scrub: true },
        });
        gsap.to("[data-hero-top]", {
          y: -80,
          autoAlpha: 0,
          ease: "none",
          scrollTrigger: { trigger: section, start: "top top", end: "45% top", scrub: true },
        });

        // The intro runs on its own clock: the shared ticker has lagSmoothing(0) for Lenis, which
        // would turn a long frame into a jump that skips most of the rise.
        const step = (_time: number, deltaTime: number) => {
          intro.time(intro.time() + (deltaTime > MAX_FRAME_MS ? 1000 / 60 : deltaTime) / 1000);
          if (intro.progress() === 1) gsap.ticker.remove(step);
        };
        let cancelIdle = () => {};
        const stopReveal = onIntroReveal(() => {
          // Repeat visits and returns to "/" reveal during hydration: start once it has settled.
          if (underCurtain) gsap.ticker.add(step);
          else cancelIdle = whenIdle(() => gsap.ticker.add(step), 400);
        });
        return () => {
          stopReveal();
          cancelIdle();
          gsap.ticker.remove(step);
          ScrollTrigger.refresh();
        };
      });

      // Tells the preloader the page has hydrated and its entrance is waiting for the curtain.
      section.dataset.introArmed = "";
      return () => {
        delete section.dataset.introArmed;
      };
    },
    { scope: root },
  );

  return (
    <section
      id="hero"
      ref={root}
      aria-labelledby="hero-title"
      className="relative isolate flex min-h-svh flex-col overflow-hidden"
    >
      <HeroField className="absolute inset-0 -z-10" />
      {/* Legibility veil under the name. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-2/3 bg-linear-to-t from-bg via-bg/70 to-transparent" />

      <div className="container-page flex flex-1 flex-col justify-between gap-y-8 pt-[calc(var(--header-h)+2.5rem)] pb-[max(clamp(1.25rem,3vw,2.5rem),env(safe-area-inset-bottom))] max-md:pb-[max(1.5rem,env(safe-area-inset-bottom))] [@media(max-height:36rem)]:gap-y-6 [@media(max-height:36rem)]:pt-[calc(var(--header-h)+1rem)]">
        <div data-hero-top className="grid grid-cols-12 gap-x-6 gap-y-8">
          <p
            data-hero-fade
            data-reveal
            className="eyebrow col-span-12 flex items-center gap-3 text-fg-muted md:col-span-5 md:mt-[calc((var(--text-lead)*var(--text-lead--line-height)_-_1lh)/2)] md:self-start lg:col-span-6 [@media(max-height:36rem)]:hidden"
          >
            <span aria-hidden className="size-2 shrink-0 rounded-[2px] bg-accent-ink" />
            Machine learning for cybersecurity
          </p>

          <div className="col-span-12 flex flex-col gap-8 md:col-span-7 md:col-start-6 lg:col-span-5 lg:col-start-7 [@media(max-height:36rem)]:col-span-12 [@media(max-height:36rem)]:col-start-1">
            <p data-hero-fade data-reveal className="text-lead text-fg [@media(max-height:36rem)]:max-w-[42rem]">
              Data scientist at {site.company}, building production machine learning that turns raw security telemetry
              into threat signals analysts can trust.
            </p>
            <div data-hero-fade data-reveal className="flex flex-nowrap items-center gap-2 sm:gap-3">
              <Magnetic>
                <ScrollLink
                  to="contact"
                  className="group inline-flex h-11 items-center gap-3 rounded-full bg-accent px-5 font-medium whitespace-nowrap text-on-accent transition-colors duration-300 sm:h-12 sm:px-6 light:bg-fg light:text-bg light:hover:bg-accent light:hover:text-on-accent"
                >
                  Let’s talk
                  <span aria-hidden className="transition-transform duration-500 ease-out group-hover:translate-x-1">
                    →
                  </span>
                </ScrollLink>
              </Magnetic>
              <ScrollLink
                to="work"
                className="group inline-flex h-11 items-center gap-3 rounded-full border border-line-strong px-5 whitespace-nowrap text-fg transition-colors duration-300 hover:border-fg sm:h-12 sm:px-6"
              >
                <span className="sm:hidden">Work</span>
                <span className="max-sm:hidden">Selected work</span>
                <span aria-hidden className="transition-transform duration-500 ease-out group-hover:translate-y-0.5">
                  ↓
                </span>
              </ScrollLink>
            </div>
          </div>
        </div>

        <div>
          <dl
            data-hero-fade
            data-reveal
            className="eyebrow mb-[clamp(1rem,2.5vw,2rem)] grid grid-cols-2 gap-x-6 gap-y-4 border-t border-line pt-4 text-balance md:grid-cols-12 [@media(max-height:36rem)]:hidden"
          >
            <div className="flex flex-col gap-1 max-md:hidden md:col-span-3">
              <dt className="text-fg-muted">Currently</dt>
              <dd>{SINCE}</dd>
            </div>
            <div className="flex flex-col gap-1 md:col-span-3">
              <dt className="text-fg-muted">Based in</dt>
              <dd>
                {site.location.city}, {site.location.country}
              </dd>
            </div>
            <div className="flex flex-col gap-1 md:col-span-6 lg:col-span-5 lg:col-start-7">
              <dt className="text-fg-muted">Headline result</dt>
              <dd className="flex items-center gap-2 font-sans text-base font-semibold tracking-normal text-fg normal-case">
                <span aria-hidden className="size-2 shrink-0 rounded-[2px] bg-accent-ink" />
                {HEADLINE_RESULT}
              </dd>
            </div>
          </dl>

          <div data-hero-name-wrap className="@container">
            <h1
              id="hero-title"
              data-hero-name
              data-reveal
              className="-ml-[0.04em] font-serif text-[length:18.9cqi] leading-[0.84] tracking-[-0.035em] whitespace-nowrap [@media(max-height:36rem)]:text-[length:clamp(3.25rem,min(16.8vw,26svh),17rem)]"
            >
              {site.name}
            </h1>
          </div>
        </div>
      </div>
    </section>
  );
}
