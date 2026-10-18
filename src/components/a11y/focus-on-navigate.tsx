"use client";

import { useEffect } from "react";
import { findRendered, focusWhenReady, hasClientNavigated } from "./route-focus";

/**
 * Renders nothing. When the page is entered by client navigation (including a return to a
 * kept-alive page), moves focus to its heading without scrolling, so the next Tab continues in the
 * new content and screen readers announce the right page. Initial loads are left alone.
 */
export function FocusOnNavigate({ target }: { target: string }) {
  useEffect(() => {
    if (!hasClientNavigated()) return;
    return focusWhenReady(() => findRendered(target));
  }, [target]);

  return null;
}
