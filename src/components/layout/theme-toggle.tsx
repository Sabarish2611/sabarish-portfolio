"use client";

import type { MouseEvent } from "react";
import { useTheme } from "@/hooks/use-preferences";
import { cn } from "@/lib/cn";
import { setTheme } from "@/lib/preferences";

/**
 * Both icons are always rendered and swapped by CSS, so server and client markup match. The state
 * is exposed as a pressed "Light theme" toggle (like the accent swatches); useTheme reads the
 * server's dark default during hydration, then the real theme.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const theme = useTheme();

  function toggle(event: MouseEvent<HTMLButtonElement>) {
    const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    const rect = event.currentTarget.getBoundingClientRect();
    setTheme(next, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Light theme"
      aria-pressed={theme === "light"}
      className={cn(
        "grid size-10 chamfer-outline place-items-center text-fg transition-colors duration-300 [--cut:0.4rem] [--outline:var(--line)] hover:[--outline:var(--line-strong)]",
        // Phones: a 44px hit area around the 40px button, on ::after (::before paints the outline).
        "max-md:after:absolute max-md:after:-inset-0.5",
        className,
      )}
    >
      {/* moon (shown in dark). Reduced motion: a short cross-fade, no spin. */}
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="absolute size-[18px] transition duration-500 ease-out light:opacity-0 motion-safe:light:scale-50 motion-safe:light:rotate-90 motion-reduce:duration-150"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7Z" strokeLinejoin="round" />
      </svg>
      {/* sun (shown in light) */}
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="absolute size-[18px] transition duration-500 ease-out dark:opacity-0 motion-safe:dark:scale-50 motion-safe:dark:-rotate-90 motion-reduce:duration-150"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
      </svg>
    </button>
  );
}
