import type { CSSProperties } from "react";

/**
 * Sticky "deck" for the project cards, shared by the server markup and the motion layer.
 * The deck only exists where a whole card fits on screen with the others stacked above it:
 * lg+ and at least 44rem tall. DECK_QUERY and the arbitrary variants below must stay in sync.
 */
export const DECK_QUERY = "(min-width: 64rem) and (min-height: 44rem)";

/** On the <ol>: in the deck, the gap is the pause before the next card starts to cover a docked one. */
export const DECK_LIST_CLASS = "flex flex-col gap-6 sm:gap-8 lg:[@media(min-height:44rem)]:gap-[10svh]";

/** On each <li>: sticks one step lower than the previous card, so their top edges stack up. */
export const DECK_ITEM_CLASS =
  "lg:[@media(min-height:44rem)]:sticky lg:[@media(min-height:44rem)]:top-[calc(var(--deck-top)+var(--i)*var(--deck-step))]";

/** On each card: one shared height, so the stack stays square. */
export const DECK_CARD_CLASS = "lg:[@media(min-height:44rem)]:h-(--card-h)";

/** Deck geometry as custom properties on the <ol>; each <li> adds its own `--i`. */
export function deckVars(count: number): CSSProperties {
  return {
    "--deck-top": "calc(var(--header-h) + 1.5rem)",
    "--deck-step": "1.25rem",
    // As tall as fits with every card stacked (plus 1.5rem of air below the last), capped at 47.5rem.
    "--card-h": `min(47.5rem, calc(100svh - var(--deck-top) - ${count - 1} * var(--deck-step) - 1.5rem))`,
  } as CSSProperties;
}

export function deckItemVars(index: number): CSSProperties {
  return { "--i": index } as CSSProperties;
}
