import type { Metadata } from "next";
import { About } from "@/components/sections/about";
import { Contact } from "@/components/sections/contact";
import { Experience } from "@/components/sections/experience";
import { Hero } from "@/components/sections/hero";
import { Toolkit } from "@/components/sections/toolkit";
import { Work } from "@/components/sections/work";
import { PersonJsonLd } from "@/components/seo/person-json-ld";
import { PageTransition } from "@/components/work/page-transition";
import { BASE_OPEN_GRAPH } from "@/lib/metadata";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  openGraph: { ...BASE_OPEN_GRAPH, url: "/" },
};

export default function Home() {
  return (
    <PageTransition>
      {/* The hero's name docks into the header logo (sections/hero.tsx), so on this page the logo waits,
          hidden, until the hero's motion layer takes it over; same 4s failsafe as [data-reveal]. Page
          scoped: a body:has(#hero) rule would re-test the whole page on every DOM change, which the text
          splitting makes thousands of. Next keeps this page in the document (hidden) after you leave
          it, so the rule stays too: the hero's cleanup shows the logo with inline styles, which win. */}
      <style>{`@media (prefers-reduced-motion: no-preference){html[data-js] [data-header-logo]{visibility:hidden;animation:reveal-failsafe 0s linear 4s forwards}}`}</style>
      <main id="main">
        <PersonJsonLd />
        <Hero />
        <About />
        <Experience />
        <Work />
        <Toolkit />
        <Contact />
      </main>
    </PageTransition>
  );
}
