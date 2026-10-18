"use client";

import { useLenis } from "lenis/react";
import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { DURATION, EASE, gsap, useGSAP } from "@/lib/gsap";
import { DECK_LIST_CLASS, DECK_QUERY, deckVars } from "./deck";

/** Each covered card ends a little smaller than the one stacked on it, so the deck reads as depth. */
const SCALE_STEP = 0.02;
/** Shade over a card once the next one has landed on it. */
const SHADE_OPACITY = 0.5;
/** Secondary entrances are opacity-only and short; only masked reveals travel. */
const FADE = 0.3;

type Geometry = { offsets: number[]; tops: number[] };

/**
 * Natural (un-stuck) offset of every item inside the list, plus each item's sticky `top` in px.
 * Sticky boxes move while stuck, so positions come from the list and the item heights instead.
 */
function measure(list: HTMLElement, items: HTMLElement[]): Geometry {
  const gap = parseFloat(getComputedStyle(list).rowGap) || 0;
  const offsets: number[] = [];
  let y = 0;
  for (const item of items) {
    offsets.push(y);
    y += item.offsetHeight + gap;
  }
  return { offsets, tops: items.map((item) => parseFloat(getComputedStyle(item).top) || 0) };
}

type Entrance = { card: HTMLElement; statPieces: HTMLElement[]; statDrops: number[] };

/**
 * The reads behind one card's entrance — each stat piece's drop (its box height) and every target's
 * transform, which GSAP parses and caches on first use with a layout read — so they can all run
 * before the first write instead of forcing a reflow per tween.
 */
function prepareEntrance(card: HTMLElement): Entrance {
  const statPieces = gsap.utils
    .toArray<HTMLElement>(card.querySelectorAll("[data-card-stats] > div"))
    .flatMap((group) => [group.querySelector("dd"), group.querySelector("dt")].filter((el): el is HTMLElement => el !== null));
  const statDrops = statPieces.map((el) => el.parentElement?.offsetHeight ?? 0);
  const targets = card.querySelectorAll("[data-card-title], [data-card-meta], [data-card-copy], [data-card-footer]");
  for (const el of [...targets, ...statPieces]) gsap.getProperty(el, "y");
  return { card, statPieces, statDrops };
}

/**
 * Title slides out of its mask, stat values roll up, the rest fades in — once per card.
 * Fades are opacity-only (no autoAlpha): content waiting to enter stays in the accessibility tree.
 */
function entrance({ card, statPieces, statDrops }: Entrance) {
  const q = gsap.utils.selector(card);

  // Containers become visible now; their pieces start hidden by masks or by the from() states.
  gsap.set(q("[data-reveal]"), { autoAlpha: 1 });
  gsap
    .timeline({ defaults: { ease: EASE.out }, scrollTrigger: { trigger: card, start: "top 85%", once: true } })
    .from(q("[data-card-title]"), { yPercent: 110, duration: DURATION.slow }, 0)
    .from(q("[data-card-meta]"), { opacity: 0, duration: FADE }, 0.1)
    .from(q("[data-card-copy]"), { opacity: 0, duration: FADE }, 0.18)
    .from(statPieces, { y: (i: number) => statDrops[i], duration: DURATION.slow, stagger: 0.07 }, 0.28)
    .from(q("[data-card-footer]"), { opacity: 0, duration: FADE }, 0.5);
}

/** As the next card slides over a docked card, the docked one recedes: it scales down and dims. */
function deckScrub(list: HTMLElement, items: HTMLElement[]) {
  items.slice(0, -1).forEach((item, i) => {
    const card = item.querySelector<HTMLElement>("[data-card]");
    const shade = item.querySelector<HTMLElement>("[data-card-shade]");
    if (!card || !shade) return;
    // Once the next card has landed on this one only a dimmed sliver shows: its visual can rest.
    const cover = (covered: boolean) => () => card.toggleAttribute("data-covered", covered);
    // "When the next card's top (natural position) reaches viewport y" — re-measured on every refresh.
    const nextCardAt = (viewportY: (geometry: Geometry) => number) => () => {
      const geometry = measure(list, items);
      return `top+=${geometry.offsets[i + 1]} ${viewportY(geometry)}px`;
    };

    gsap
      .timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: list,
          // From the moment the next card starts to cover this one…
          start: nextCardAt((g) => Math.min(window.innerHeight, g.tops[i] + item.offsetHeight)),
          // …until it lands in its own slot.
          end: nextCardAt((g) => g.tops[i + 1]),
          scrub: true,
          onLeave: cover(true),
          onEnterBack: cover(false),
          onLeaveBack: cover(false),
        },
      })
      .to(card, { scale: 1 - (items.length - 1 - i) * SCALE_STEP, transformOrigin: "50% 0%" }, 0)
      .to(shade, { opacity: SHADE_OPACITY }, 0);
  });
}

/**
 * The project list. On lg+ (tall enough) its items are sticky and stack like a deck; elsewhere it
 * is a plain column. Expects server-rendered <li> children wrapping <ProjectCard>s.
 */
export function ProjectDeck({ count, className, children }: { count: number; className?: string; children: ReactNode }) {
  const ref = useRef<HTMLOListElement>(null);
  const lenis = useLenis();
  const lenisRef = useRef(lenis);

  useEffect(() => {
    lenisRef.current = lenis;
  }, [lenis]);

  useGSAP(
    () => {
      const list = ref.current;
      if (!list) return;
      const items = gsap.utils.toArray<HTMLElement>(list.children);
      const cards = items
        .map((item) => item.querySelector<HTMLElement>("[data-card]"))
        .filter((card): card is HTMLElement => card !== null);
      const mm = gsap.matchMedia();

      mm.add({ motion: "(prefers-reduced-motion: no-preference)", deck: DECK_QUERY }, (context) => {
        const { motion, deck } = context.conditions!;

        // Every card's reads before the first write.
        if (motion) cards.map(prepareEntrance).forEach(entrance);
        else gsap.set(list.querySelectorAll("[data-reveal]"), { autoAlpha: 1 });

        if (!deck) return;
        if (motion) deckScrub(list, items);

        // Keyboard focus on a card that is covered or off screen: put it in its slot so it is fully
        // visible — instantly. A glide would still be running when focus moves on (tabbing out of
        // the deck), and drag the next focus target off screen.
        const onFocusIn = (event: FocusEvent) => {
          const target = event.target;
          if (!(target instanceof HTMLElement) || !target.matches(":focus-visible")) return;
          const index = items.findIndex((item) => item.contains(target));
          if (index < 0) return;
          const { offsets, tops } = measure(list, items);
          const rect = items[index].getBoundingClientRect();
          const nextTop = items[index + 1]?.getBoundingClientRect().top ?? Infinity;
          if (rect.top >= tops[index] - 1 && rect.bottom <= Math.min(window.innerHeight, nextTop) + 1) return;
          const y = list.getBoundingClientRect().top + window.scrollY + offsets[index] - tops[index];
          if (lenisRef.current) lenisRef.current.scrollTo(y, { immediate: true, force: true });
          else window.scrollTo({ top: y, behavior: "instant" });
        };
        list.addEventListener("focusin", onFocusIn);
        return () => {
          list.removeEventListener("focusin", onFocusIn);
          cards.forEach((card) => card.removeAttribute("data-covered"));
        };
      });
    },
    { scope: ref },
  );

  return (
    <ol
      ref={ref}
      role="list"
      style={deckVars(count)}
      className={cn(DECK_LIST_CLASS, className)}
    >
      {children}
    </ol>
  );
}
