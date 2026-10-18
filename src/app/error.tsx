"use client";

import Link from "next/link";
import { useEffect } from "react";
import { PILL_PRIMARY, PILL_SECONDARY, SystemPage } from "@/components/seo/system-page";
import { STORAGE_KEYS } from "@/lib/preferences";

/** Server errors carry a digest that matches the server log entry. */
function errorDigest(error: unknown) {
  if (error instanceof Error && "digest" in error && typeof error.digest === "string") return error.digest;
  return null;
}

export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  // When an error escapes SSR, React renders the whole document on the client and the inline
  // preferences script in <head> never executes — restore the visitor's theme and accent.
  useEffect(() => {
    const root = document.documentElement;
    try {
      const theme = localStorage.getItem(STORAGE_KEYS.theme);
      const accent = localStorage.getItem(STORAGE_KEYS.accent);
      if (theme === "light" || theme === "dark") root.dataset.theme = theme;
      if (accent === "lime" || accent === "orange") root.dataset.accent = accent;
    } catch {}
  }, []);

  const digest = errorDigest(error);

  return (
    <SystemPage
      animate={false}
      eyebrow="Unexpected error"
      title={
        <>
          Something <span className="text-fg-muted italic">broke.</span>
        </>
      }
      lead={
        <>
          <p className="text-fg">An unexpected error interrupted this page.</p>
          <p className="mt-3">It’s usually temporary — try again, or head back home.</p>
          {digest ? <p className="eyebrow mt-6 text-fg-muted">Reference {digest}</p> : null}
        </>
      }
      actions={
        <>
          <button type="button" onClick={() => retry()} className={PILL_PRIMARY}>
            Try again
          </button>
          <Link href="/" className={PILL_SECONDARY}>
            Back to home
          </Link>
        </>
      }
    />
  );
}
