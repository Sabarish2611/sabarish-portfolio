import { focusTarget } from "@/lib/focus-section";

/**
 * Route-change focus. On client navigation Next leaves focus where it was (the clicked link, or
 * <body> once that link's page is hidden), so the next Tab restarts in the header or footer and
 * screen readers announce nothing useful. After a client navigation the destination's heading
 * takes focus; the first document load keeps the browser default (the skip link comes first).
 */
let navigated = false;

/** Called by RouteScrollReset when the pathname changes on the client. */
export function markClientNavigation() {
  navigated = true;
}

export function hasClientNavigated() {
  return navigated;
}

/** Kept-alive routes (React <Activity>) leave hidden copies of a page, ids included, in the DOM. */
export function findRendered(id: string) {
  for (const el of document.querySelectorAll<HTMLElement>(`#${CSS.escape(id)}`)) {
    if (el.getClientRects().length > 0) return el;
  }
  return null;
}

/** Longest wait for an open dialog to close first (~3s). */
const DIALOG_WAIT_FRAMES = 180;

/**
 * Focuses the element as soon as it can take focus: entrance animations keep some headings
 * `visibility: hidden` until their first frame. Gives up after `frames`, or when focus moves
 * somewhere else in the meantime. Returns a cancel function.
 */
export function focusWhenReady(find: () => HTMLElement | null, frames = 30) {
  let initial: Element | null = null;
  let dialogWait = DIALOG_WAIT_FRAMES;
  let raf = 0;
  const attempt = (left: number) => {
    // An open modal (the mobile menu animating out after a link to another page) keeps the page
    // inert, and hands focus back to its opener as it closes: wait for that first.
    if (dialogWait > 0 && document.querySelector("dialog[open]")) {
      dialogWait--;
      raf = requestAnimationFrame(() => attempt(left));
      return;
    }
    initial ??= document.activeElement;
    const active = document.activeElement;
    if (active !== initial && active !== document.body) return;
    const el = find();
    if (el) focusTarget(el);
    if (el && document.activeElement === el) return;
    if (left > 0) raf = requestAnimationFrame(() => attempt(left - 1));
  };
  attempt(frames);
  return () => cancelAnimationFrame(raf);
}
