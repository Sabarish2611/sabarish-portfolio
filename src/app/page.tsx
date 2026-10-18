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
      <main id="main">
        <PersonJsonLd />
        <Hero />
        <About />
        <Work />
        <Experience />
        <Toolkit />
        <Contact />
      </main>
    </PageTransition>
  );
}
