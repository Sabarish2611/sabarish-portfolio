"use client";

import { useRef } from "react";
import { ToolkitMap } from "@/components/hero/toolkit-map";
import { Magnetic } from "@/components/ui/magnetic";
import { RollText } from "@/components/ui/roll-text";
import { ScrollLink } from "@/components/ui/scroll-link";
import { site } from "@/content/site";
import { DURATION, EASE, gsap, ScrollTrigger, SplitText, useGSAP } from "@/lib/gsap";
import { onIntroReveal } from "@/lib/intro";

// The meta row above the name. No-break space: on phones "Tamil Nadu" wraps as one.
const CURRENTLY = `${site.role} at ${site.company}`;
const BASED_IN = `${site.location.city}, ${site.location.region.replace(" ", "\u00A0")}, ${site.location.country}`;

/**
 * Intro timeline offsets (s). The copy fades in first, so the first screen is never empty. On a
 * first visit the intro starts as the preloader curtain begins to lift, so the name waits until
 * the curtain clears the bottom of the screen, where it sits.
 */
const FADES_AT = 0.05;
const NAME_AT_UNDER_CURTAIN = 0.3;

/** A longer frame (hydration, the text splitting) advances the intro by a single 60fps frame. */
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

/** Scroll progress by which the initial has joined the first name: the copy then reads "Sabarish G". */
const JOIN_BY = 0.35;
const sinkEase = gsap.parseEase("power1.in");
const joinEase = gsap.parseEase("power2.inOut");

/**
 * Scroll-scrubbed dock of the hero name into the header logo: "Sabarishwaran G" contracts to the
 * logo's "Sabarish G". A copy of the name that lives in the header, set at the name's size and sitting
 * exactly over it, takes over as soon as the page scrolls, so the whole name shrinks as one. "waran"
 * sinks into its masks, last letter first (the intro in reverse), and the initial slides over the
 * emptied masks to meet the first name. The copy rides along with the page at first, then curves up
 * into the header, shrinking to the logo's size, and its baseline lands on the logo's. The real logo
 * takes over the moment the copy parks in its slot. Returns a cleanup that hands the logo back.
 */
function dockName(section: HTMLElement, name: HTMLElement, chars: Element[]) {
  const dock = document.querySelector<HTMLElement>("[data-dock]");
  const dockInitial = dock?.querySelector<HTMLElement>("[data-dock-initial]");
  const dropped = dock ? Array.from(dock.querySelectorAll<HTMLElement>("[data-dock-dropped]")) : [];
  const logo = document.querySelector<HTMLElement>("[data-header-logo]");
  const link = logo?.querySelector("a");
  const word = link?.firstChild; // the wordmark's text, "Sabarish G"
  const header = document.querySelector("header");
  const initial = chars.at(-1); // the name's "G"
  if (!dock || !dockInitial || !logo || !link || !word || !header || !initial) return () => {};

  const g = { offset: 0, height: 1, startLeft: 0, endLeft: 0, endTop: 0, scale: 1, from: 0, to: 0, c0: 0 };
  /** Where the copy is at scroll progress p, and how far (0-1) it has climbed toward the landing line. */
  const flight = (p: number) => {
    // Where the name itself is now, but never above the landing line: once the name has scrolled past
    // it, the copy parks in the logo's slot instead of overshooting and sinking back.
    const follow = Math.max(g.endTop, g.offset - p * g.height);
    const y = follow + (g.endTop - follow) * p ** 1.5;
    return { y, climbed: Math.min(1, Math.max(0, (g.offset - y) / Math.max(1, g.offset - g.endTop))) };
  };
  const measure = () => {
    const size = parseFloat(getComputedStyle(name).fontSize);
    dock.style.fontSize = `${size}px`; // first: the initial's place in the copy is read at this size
    const nameBox = name.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(word);
    const text = range.getBoundingClientRect();
    const wordmark = word.textContent ?? "";
    range.setStart(word, wordmark.length - 1);
    range.setEnd(word, wordmark.length);
    const logoInitial = range.getBoundingClientRect();
    const logoSize = parseFloat(getComputedStyle(link).fontSize);
    // The glyphs' content area, as a share of the font size (same font as the name).
    const content = text.height / logoSize;
    g.offset = nameBox.top - section.getBoundingClientRect().top;
    g.height = section.offsetHeight;
    g.startLeft = nameBox.left;
    g.endLeft = text.left;
    // Baselines meet: the copy's line box is 0.84em tall, the logo's content area `content`em.
    g.endTop = text.top - header.getBoundingClientRect().top - (logoSize * (0.84 - content)) / 2;
    g.scale = logoSize / size;
    // The copy's initial, in the copy's own (unscaled) pixels: shifted at first to sit exactly over the
    // name's "G", at the end over the logo's.
    g.from = initial.getBoundingClientRect().left - nameBox.left - dockInitial.offsetLeft;
    g.to = (logoInitial.left - text.left) / g.scale - dockInitial.offsetLeft;
    // The climb by the first frame the copy shows: the shrink starts from there, so that frame matches
    // the name exactly.
    g.c0 = flight(0.001).climbed;
  };

  const render = (p: number) => {
    const { y, climbed } = flight(p);
    // Parked exactly on the landing line (y === endTop): the real logo takes over right there.
    const docked = p >= 0.999 || climbed >= 1;
    const flying = p > 0.001 && !docked;
    // Size and the small sideways shift follow the climb, not the scroll: the copy is logo-sized and in
    // place by the time it reaches the header, rather than arriving big and shrinking in place.
    const c = Math.max(0, (climbed - g.c0) / (1 - g.c0));
    gsap.set(dock, {
      x: g.startLeft + (g.endLeft - g.startLeft) * c,
      y,
      scale: 1 + (g.scale - 1) * c,
      autoAlpha: flying ? 1 : 0,
    });
    // The contraction, complete by JOIN_BY (and always by the time the copy parks): the dropped letters
    // sink in the first half, last letter first; the initial sets off once the letters it passes are gone.
    const t = Math.max(Math.min(1, p / JOIN_BY), climbed);
    const step = (from: number, length: number) => Math.min(1, Math.max(0, (t - from) / length));
    dropped.forEach((letter, i) => {
      const order = (dropped.length - 1 - i) / Math.max(1, dropped.length - 1); // 0: the last letter
      gsap.set(letter, { yPercent: 118 * sinkEase(step(order * 0.2, 0.3)) });
    });
    gsap.set(dockInitial, { x: g.from + (g.to - g.from) * joinEase(step(0.2, 0.8)) });
    gsap.set(chars, { opacity: p > 0.001 ? 0 : 1 });
    gsap.set(logo, { autoAlpha: docked ? 1 : 0 });
    // The page's 4s failsafe animation can force the hidden logo visible (animations beat inline
    // styles), so until the copy lands it's also out of the tab order, the pointer's way and the
    // accessibility tree.
    if (logo.inert === docked) logo.inert = !docked;
  };

  measure();
  const trigger = ScrollTrigger.create({
    trigger: section,
    start: "top top",
    end: "bottom top",
    onUpdate: (self) => render(self.progress),
    onRefresh: (self) => {
      measure();
      render(self.progress);
    },
  });
  render(trigger.progress);

  return () => {
    trigger.kill();
    gsap.set(dock, { autoAlpha: 0 });
    gsap.set([dockInitial, ...dropped], { clearProps: "transform" });
    // Shown inline, to beat the page's pre-hide <style>: Next keeps "/" in the document (hidden) after
    // you leave it, so that rule would otherwise hide the logo on the next page too.
    gsap.set(logo, { autoAlpha: 1 });
    logo.inert = false;
  };
}

/*
 * Short viewports (under 36rem tall: landscape phones, 320×568) get a compact hero, so the name
 * stays above the fold: the eyebrow, map and meta row drop out, the top tightens and the name is
 * capped by height as well as width. Tailwind variants:
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

        // Leaving the hero, the name docks into the header logo: a copy that lives in the header takes
        // over, contracts to "Sabarish G" ("waran" sinks away, the initial joins) and flies up into it.
        const stopDock = dockName(section, name, split.chars);

        // The copy above the name lifts away; the meta row goes first, before the name flies through it.
        gsap.to("[data-hero-top]", {
          y: -80,
          autoAlpha: 0,
          ease: "none",
          scrollTrigger: { trigger: section, start: "top top", end: "45% top", scrub: true },
        });
        gsap.to("[data-hero-meta]", {
          y: -40,
          autoAlpha: 0,
          ease: "none",
          scrollTrigger: { trigger: section, start: "top top", end: "20% top", scrub: true },
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
          stopDock();
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
      className="relative isolate flex min-h-svh flex-col overflow-x-clip"
    >
      <div className="container-page flex flex-1 flex-col justify-between gap-y-8 pt-[calc(var(--header-h)+2.5rem)] pb-[max(clamp(1.25rem,3vw,2.5rem),env(safe-area-inset-bottom))] max-md:pb-[max(1.5rem,env(safe-area-inset-bottom))] [@media(max-height:36rem)]:gap-y-6 [@media(max-height:36rem)]:pt-[calc(var(--header-h)+1rem)]">
        {/* Label on the left, the two actions a visitor most wants on the right: talk, or take the résumé. */}
        <div data-hero-top className="flex flex-col gap-6 md:flex-row md:items-center md:gap-8">
          <p
            data-hero-fade
            data-reveal
            className="eyebrow flex items-start gap-3 text-fg-muted md:shrink-[100] [@media(max-height:36rem)]:hidden"
          >
            <span aria-hidden className="mt-[calc((1lh_-_0.5rem)/2)] size-2 shrink-0 rounded-[2px] bg-accent-ink" />
            {/* One line where it fits (lg+); narrower, the last role takes its own line. Each dot is tied to
                the role after it (no-break space), so a wrap (enlarged text) never strands one at a line end. */}
            <span>
              <span className="whitespace-nowrap">Data Scientist</span>
              {" ·\u00A0"}
              <span className="whitespace-nowrap">AI Engineer</span>
              <span className="max-lg:hidden">{" ·\u00A0"}</span>
              <span className="max-lg:block lg:whitespace-nowrap">Forward Deployed Engineer</span>
            </span>
          </p>

          {/* Pushed right even when it's alone in the row (short screens drop the label). Wraps, rather than
              running off the screen, when the text is enlarged. */}
          <div
            data-hero-fade
            data-reveal
            className="flex flex-wrap items-center gap-2 sm:gap-3 md:ml-auto md:justify-end [@media(max-height:36rem)]:ml-auto [@media(max-height:36rem)]:justify-end"
          >
            {/* A gentle pull: at the default strength it would slide over the Résumé button beside it. */}
            <Magnetic strength={0.15}>
              <ScrollLink
                to="contact"
                className="group relative isolate inline-flex h-10 items-center gap-2.5 px-4.5 text-[0.9375rem] font-medium whitespace-nowrap text-on-accent transition-colors duration-300 [--cut:0.5rem] light:text-bg light:hover:text-on-accent"
              >
                {/* Cut-corner fill on its own layer: a clip-path on the link would clip its focus ring. */}
                <span
                  aria-hidden
                  className="chamfer absolute inset-0 -z-10 bg-accent transition-colors duration-300 light:bg-fg light:group-hover:bg-accent"
                />
                <RollText>Let’s talk</RollText>
                <span aria-hidden className="transition-transform duration-500 ease-out group-hover:translate-x-1">
                  →
                </span>
              </ScrollLink>
            </Magnetic>
            <a
              href={site.links.resume}
              download
              className="group relative isolate inline-flex h-10 items-center gap-2.5 px-4.5 text-[0.9375rem] whitespace-nowrap text-fg [--cut:0.5rem]"
            >
              <span
                aria-hidden
                className="chamfer-ring absolute inset-0 -z-10 bg-line-strong transition-colors duration-300 group-hover:bg-fg"
              />
              <RollText>Résumé</RollText>
              <span className="sr-only"> (PDF)</span>
              <span aria-hidden className="transition-transform duration-500 ease-out group-hover:translate-y-0.5">
                ↓
              </span>
            </a>
          </div>
        </div>

        {/* The toolkit as an embedding plot, between the intro copy and the name. Short screens drop it. */}
        <div data-hero-top className="relative min-h-[17rem] flex-1 md:min-h-[19rem] [@media(max-height:36rem)]:hidden">
          <ToolkitMap className="absolute inset-0" />
        </div>

        <div>
          {/* The scroll fade sits on a wrapper: the intro fades the list itself in. */}
          <div data-hero-meta>
            <dl
              data-hero-fade
              data-reveal
              className="eyebrow mb-[clamp(1rem,2.5vw,2rem)] grid grid-cols-2 gap-x-6 gap-y-4 border-t border-line pt-4 text-balance md:grid-cols-12 [@media(max-height:36rem)]:hidden"
            >
              <div className="flex flex-col gap-1 md:col-span-4">
                <dt className="text-fg-muted">Currently</dt>
                <dd>{CURRENTLY}</dd>
              </div>
              <div className="flex flex-col gap-1 md:col-span-4">
                <dt className="text-fg-muted">Based in</dt>
                <dd>{BASED_IN}</dd>
              </div>
              {/* Flush right, under the buttons, like the label and the buttons above. */}
              <div className="col-span-2 flex flex-col gap-1 md:col-span-4 md:items-end md:text-right">
                <dt className="text-fg-muted">Open to</dt>
                <dd className="flex items-center gap-2 text-fg">
                  <span aria-hidden className="size-2 shrink-0 rounded-[2px] bg-accent-ink" />
                  {site.openTo}
                </dd>
              </div>
            </dl>
          </div>

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
