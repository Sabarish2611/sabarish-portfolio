import { ViewTransition, type ReactNode } from "react";

// Only typed navigations slide (Link transitionTypes); browser back/forward and refreshes swap
// instantly. The .nav-forward / .nav-back animations live in globals.css.
const DIRECTIONAL = { "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" };

/**
 * Directional page transition. Wrap each participating page's content in its page.tsx — never in a
 * layout, which persists across navigations so enter/exit would never fire. Server-compatible.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition enter={DIRECTIONAL} exit={DIRECTIONAL} default="none">
      {children}
    </ViewTransition>
  );
}
