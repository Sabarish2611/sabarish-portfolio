import { cacheLife } from "next/cache";
import type { ReactNode } from "react";
import { ScrollLink } from "@/components/ui/scroll-link";
import { site } from "@/content/site";
import { SECTIONS } from "@/lib/ui-events";
import { BackToTop, FooterWordmark } from "./footer-islands";

const [firstName] = site.name.split(" ");

/** Prerender-safe year: cached into the static shell instead of reading the clock during render. */
async function CurrentYear() {
  "use cache";
  cacheLife("days");
  return <>{new Date().getFullYear()}</>;
}

function ColumnTitle({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <h2 id={id} className="eyebrow text-fg-muted">
      {children}
    </h2>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="container-page grid grid-cols-12 gap-x-3 gap-y-12 pt-16 pb-16 sm:gap-x-6 md:pt-24 md:pb-24">
        <nav aria-labelledby="footer-navigate" className="col-span-6 md:col-span-4 lg:col-span-3">
          <ColumnTitle id="footer-navigate">Navigate</ColumnTitle>
          <ul className="mt-4">
            {SECTIONS.map((section, i) => (
              <li key={section.id}>
                <ScrollLink to={section.id} className="group inline-flex h-10 items-center gap-3">
                  <span className="eyebrow text-fg-muted transition-colors duration-300 group-hover:text-accent-ink">
                    0{i + 1}
                  </span>
                  <span className="link-draw">{section.label}</span>
                </ScrollLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="col-span-6 md:col-span-4 lg:col-span-5">
          <ColumnTitle>Colophon</ColumnTitle>
          <p className="mt-6 max-w-[34ch] text-fg-muted">
            {"Designed & built with Next.js and GSAP. Set in "}
            <span className="font-serif text-[1.15em] text-fg italic">Instrument Serif</span>
            {", "}
            <span className="text-fg">Geist</span> and <span className="font-mono text-[0.9em] text-fg">Geist Mono</span>.
          </p>
        </div>

        <div className="col-span-12 md:col-span-4 md:col-start-9 md:row-start-1 md:justify-self-end lg:col-span-2 lg:col-start-11">
          <BackToTop />
        </div>
      </div>

      <div className="container-page">
        <FooterWordmark text={firstName} />
        <div className="eyebrow flex items-center justify-between gap-6 border-t border-line py-5 text-fg-muted">
          <p>
            © <CurrentYear />
            {` ${site.name}`}
          </p>
        </div>
      </div>
    </footer>
  );
}
