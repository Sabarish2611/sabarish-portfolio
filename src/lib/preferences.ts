import { site } from "@/content/site";

export type Theme = "dark" | "light";
export type Accent = "lime" | "orange";

export const THEMES = ["dark", "light"] as const satisfies readonly Theme[];
export const ACCENTS = ["lime", "orange"] as const satisfies readonly Accent[];

export const DEFAULT_THEME: Theme = "dark";
export const DEFAULT_ACCENT: Accent = "lime";

export const STORAGE_KEYS = {
  theme: "theme",
  accent: "accent",
  /** sessionStorage: the preloader plays once per browser session. */
  intro: "intro-seen",
} as const;

/**
 * getTimezoneOffset() of a visitor whose clock reads the same as Sabarish's: minutes behind UTC, so
 * UTC+5:30 is -330. From site.location.utcOffset; valid because IST has no daylight saving.
 */
const HOME_CLOCK_OFFSET = (() => {
  const match = /^UTC([+-])(\d{1,2})(?::(\d{2}))?$/.exec(site.location.utcOffset);
  if (!match) throw new Error(`preferences: can't read the UTC offset "${site.location.utcOffset}".`);
  const minutes = Number(match[2]) * 60 + Number(match[3] ?? 0);
  return match[1] === "+" ? -minutes : minutes;
})();

/**
 * Runs in <head> before first paint so the page never flashes the wrong theme or accent.
 * The intro only plays on a first visit that lands on the home page — deep links (a shared case
 * study) open straight onto their content. `data-js` is set last: content that waits for an
 * entrance animation is only hidden when this script actually ran, so the site stays fully
 * readable without JavaScript. `data-clock` says whether the visitor's clock reads the same as the
 * one where Sabarish is based ("same") or not ("other"), so Contact shows one line or its two clocks
 * from the first frame instead of changing height once it hydrates.
 */
export const PREFERENCES_SCRIPT = `(function(){try{var d=document.documentElement,t=localStorage.getItem("${STORAGE_KEYS.theme}"),a=localStorage.getItem("${STORAGE_KEYS.accent}");d.dataset.theme=t==="light"?"light":"dark";d.dataset.accent=a==="orange"?"orange":"lime";if(location.pathname!=="/"||sessionStorage.getItem("${STORAGE_KEYS.intro}")||matchMedia("(prefers-reduced-motion: reduce)").matches)d.dataset.intro="skip";d.dataset.clock=new Date().getTimezoneOffset()===${HOME_CLOCK_OFFSET}?"same":"other";d.dataset.js="";}catch(e){}})();`;

type Origin = { x: number; y: number };

function commitWithTransition(commit: () => void, kind: "theme" | "accent", origin?: Origin) {
  const root = document.documentElement;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!document.startViewTransition || reduce) {
    commit();
    return;
  }
  if (origin) {
    root.style.setProperty("--vt-x", `${origin.x}px`);
    root.style.setProperty("--vt-y", `${origin.y}px`);
  }
  root.dataset.vt = kind;
  document.startViewTransition(commit).finished.finally(() => {
    delete root.dataset.vt;
  });
}

/** Switch theme with a circular reveal from `origin` (the control that was pressed). */
export function setTheme(theme: Theme, origin?: Origin) {
  commitWithTransition(
    () => {
      document.documentElement.dataset.theme = theme;
      try {
        localStorage.setItem(STORAGE_KEYS.theme, theme);
      } catch {}
    },
    "theme",
    origin,
  );
}

export function setAccent(accent: Accent, origin?: Origin) {
  commitWithTransition(
    () => {
      document.documentElement.dataset.accent = accent;
      try {
        localStorage.setItem(STORAGE_KEYS.accent, accent);
      } catch {}
    },
    "accent",
    origin,
  );
}
