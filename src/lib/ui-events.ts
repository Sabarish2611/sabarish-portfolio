/** Decoupled UI commands: the header buttons fire these; the overlays listen. */
export const UI_EVENTS = {
  openCommandMenu: "ui:open-command-menu",
  toggleMobileMenu: "ui:toggle-mobile-menu",
} as const;

export function openCommandMenu() {
  window.dispatchEvent(new Event(UI_EVENTS.openCommandMenu));
}

export function toggleMobileMenu() {
  window.dispatchEvent(new Event(UI_EVENTS.toggleMobileMenu));
}

/** Section anchors on the home page, in page order. */
export const SECTIONS = [
  { id: "about", label: "About" },
  { id: "experience", label: "Experience" },
  { id: "work", label: "Projects" },
  { id: "toolkit", label: "Toolkit" },
  { id: "contact", label: "Contact" },
] as const;

export type SectionId = (typeof SECTIONS)[number]["id"];
