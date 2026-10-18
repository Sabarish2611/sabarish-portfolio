/**
 * Programmatic navigation (smooth in-page links, the command menu, client route changes) must move
 * keyboard focus too — otherwise the next Tab jumps back to where the user started, and screen
 * readers announce nothing. Focus lands on the destination heading without scrolling.
 */
export function focusTarget(el: HTMLElement | null) {
  if (!el) return;
  if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
  el.focus({ preventScroll: true });
}

/** Section headings follow the `${id}-title` convention (SectionHeader / aria-labelledby). */
export function focusSection(id: string) {
  focusTarget(document.getElementById(`${id}-title`) ?? document.getElementById(id));
}
