import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { CommandMenuLauncher } from "@/components/layout/command-menu-launcher";
import { CursorLoader } from "@/components/layout/cursor-loader";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { MobileMenu } from "@/components/layout/mobile-menu";
import { Preloader } from "@/components/layout/preloader";
import { Providers } from "@/components/providers/providers";
import { site, siteUrl } from "@/content/site";
import { BASE_OPEN_GRAPH, SITE_DESCRIPTION, SITE_TITLE } from "@/lib/metadata";
import { DEFAULT_ACCENT, DEFAULT_THEME, PREFERENCES_SCRIPT } from "@/lib/preferences";
import { Suspense } from "react";
import "./globals.css";

const serif = Instrument_Serif({
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-instrument-serif",
});

const sans = Geist({ subsets: ["latin"], variable: "--font-geist" });

const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: SITE_TITLE, template: `%s — ${site.name}` },
  description: SITE_DESCRIPTION,
  applicationName: site.name,
  authors: [{ name: site.name, url: site.links.linkedin }],
  creator: site.name,
  keywords: [
    "Sabarishwaran G",
    "data scientist",
    "AI engineer",
    "forward deployed engineer",
    "machine learning",
    "applied ML",
    "agentic AI",
    "cybersecurity",
    "threat detection",
    "MLOps",
    "Trellix",
  ],
  // Canonical and og:url live on each page (home: app/page.tsx) so the 404 never claims the home URL.
  openGraph: BASE_OPEN_GRAPH,
  twitter: { card: "summary_large_image", title: SITE_TITLE, description: SITE_DESCRIPTION },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0c" },
    { media: "(prefers-color-scheme: light)", color: "#efece6" },
  ],
  colorScheme: "dark light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-theme={DEFAULT_THEME}
      data-accent={DEFAULT_ACCENT}
      suppressHydrationWarning
      className={`${serif.variable} ${sans.variable} ${mono.variable}`}
    >
      <head>
        {/* Theme, accent and intro flags before first paint — no flash. */}
        <script dangerouslySetInnerHTML={{ __html: PREFERENCES_SCRIPT }} />
      </head>
      <body>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <Providers>
          <Preloader />
          <Header />
          <MobileMenu />
          {children}
          <Footer />
          {/* Both load their real code on demand (palette on idle/first use, cursor on fine pointers). */}
          <CommandMenuLauncher />
          <CursorLoader />
        </Providers>
        <div className="grain" aria-hidden="true" />
        {/* Vercel Web Analytics (no-op in development). It reads the route, so it needs a Suspense
            boundary under cacheComponents. */}
        <Suspense fallback={null}>
          <Analytics />
        </Suspense>
      </body>
    </html>
  );
}
