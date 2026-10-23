"use client";

import { useRef } from "react";
import { LivedInGlobe } from "@/components/places/lived-in-globe";
import { ChannelMark } from "@/components/ui/channel-mark";
import { CopyEmail } from "@/components/ui/copy-email";
import { DecodeText } from "@/components/ui/decode-text";
import { RevealText } from "@/components/ui/reveal-text";
import { site } from "@/content/site";
import { DURATION, EASE, gsap, settlePendingTriggers, useGSAP } from "@/lib/gsap";

const MAILTO = `mailto:${site.email}`;
/** The address is long: the headline sets it on two lines, the name over "@domain". */
const [EMAIL_USER, EMAIL_DOMAIN] = site.email.split("@");
/** A line of the address, masked so it can drop in from under the line above it (room for descenders). */
const MASK = "block overflow-hidden pb-[0.14em] -mb-[0.14em]";
/**
 * The other ways in, listed under the address with their marks, each in a new tab. The résumé opens in
 * the browser's PDF viewer, which has its own download button, so nobody downloads it by accident.
 */
const LINKS = [
  { label: "LinkedIn", href: site.links.linkedin, mark: "linkedin", note: "(opens in new tab)" },
  { label: "GitHub", href: site.links.github, mark: "github", note: "(opens in new tab)" },
  { label: "Résumé", href: site.links.resume, mark: "resume", note: "(PDF, opens in new tab)" },
] as const;
const MARK = "size-4 text-fg-muted transition-colors duration-500 group-hover:text-fg";
/** The underline draws wherever the link is hovered or focused, its mark included. */
const DRAW = "link-draw group-hover:bg-size-[100%_1px] group-focus-visible:bg-size-[100%_1px]";
const ARROW = "text-fg-muted transition-[translate,color] duration-500 ease-out group-hover:text-accent-ink";

/**
 * (05) Contact — the finale. The address is the headline: it hangs from a line under "Let's talk.",
 * and it opens the visitor's mail app, with Copy email under it, then LinkedIn, GitHub and the résumé,
 * each with its mark, and where Sabarish is based. A live globe of the cities
 * Sabarish has lived in (places/lived-in-globe.tsx) sits on the left from tablets up (after the address
 * in reading order, so phones and screen readers get the heading first). Entrance: the line draws out,
 * the address drops in from under it, the rest rises in behind. Fits one screen from tablets up.
 */
export function Contact() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    (context) => {
      const section = root.current;
      if (!section) return;
      let mm: gsap.MatchMedia | undefined;
      // Outside useGSAP's context, so hiding the route reverts it once (see playWithMotion in
      // work/visuals/shared.tsx).
      context.ignore(() => {
        mm = gsap.matchMedia();
        const line = section.querySelector<HTMLElement>("[data-contact-line]");
        const address = section.querySelector<HTMLElement>("[data-contact-address]");
        const drops = gsap.utils.toArray<HTMLElement>("[data-contact-drop]", section);
        const items = gsap.utils.toArray<HTMLElement>("[data-contact-item]", section);

        mm.add("(prefers-reduced-motion: reduce)", () => {
          gsap.set([line, address, ...items], { autoAlpha: 1 });
        });

        mm.add("(prefers-reduced-motion: no-preference)", () => {
          if (!line || !address) return;
          settlePendingTriggers();
          const entrance = gsap
            .timeline({ scrollTrigger: { trigger: line, start: "top 85%", once: true } })
            .fromTo(line, { scaleX: 0 }, { scaleX: 1, duration: DURATION.slow, ease: EASE.inOut }, 0)
            .fromTo(drops, { yPercent: -120 }, { yPercent: 0, duration: DURATION.base, ease: EASE.out, stagger: 0.09 }, 0.35)
            // Opacity, not autoAlpha: the actions stay in the tab order before the entrance has played.
            .fromTo(items, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: DURATION.base, ease: EASE.out, stagger: 0.08 }, 0.6);
          // The fromTos above have set their start states, so everything can show without a flash of its
          // finished look (a /#contact link lands here before the entrance starts).
          gsap.set([line, address], { autoAlpha: 1 });
          gsap.set(items, { visibility: "visible" });
          // Tabbing in before the section has scrolled into view finishes the entrance at once.
          const finish = () => void entrance.progress(1);
          section.addEventListener("focusin", finish);
          return () => section.removeEventListener("focusin", finish);
        });
      });
      return () => mm?.revert();
    },
    { scope: root },
  );

  return (
    <section id="contact" ref={root} aria-labelledby="contact-title" className="section-pad">
      <div className="container-page grid grid-cols-12 gap-x-3 gap-y-10 sm:gap-x-6 md:grid-rows-[auto_auto_1fr] md:gap-y-[clamp(1.25rem,4svh,3rem)]">
        <p className="eyebrow col-span-12 flex items-center gap-3 text-fg-muted">
          <span className="text-accent-ink">(05)</span>
          <span aria-hidden className="h-px w-8 bg-line-strong" />
          <DecodeText>Contact</DecodeText>
        </p>

        <div className="col-span-12 flex flex-col md:col-span-7 md:col-start-6 md:row-start-2">
          <RevealText
            as="h2"
            id="contact-title"
            className="font-serif text-[length:clamp(2.25rem,min(4.2vw,6.5svh),4.5rem)] leading-[0.95] tracking-[-0.03em]"
          >
            {"Let’s "}
            <span data-hl className="hl italic">
              talk.
            </span>
          </RevealText>

          <span
            data-contact-line
            data-reveal
            aria-hidden
            className="mt-[clamp(0.75rem,2svh,1.25rem)] block h-px origin-left bg-line-strong"
          />

          {/* The address is the headline and the way to write: it opens the visitor's mail app. */}
          <a
            data-contact-address
            data-reveal
            href={MAILTO}
            // Named as one address: the two lines are blocks, which would read with a space between them.
            aria-label={site.email}
            className="group mt-[clamp(0.5rem,1.4svh,1rem)] block w-fit font-serif text-[length:clamp(2.125rem,9.4vw,3.5rem)] leading-[0.95] tracking-[-0.025em] md:text-[length:min(5.2vw,9svh)]"
          >
            <span className={MASK}>
              <span
                data-contact-drop
                className="block bg-[linear-gradient(currentColor,currentColor)] bg-[length:0%_1px] bg-[position:0_100%] bg-no-repeat transition-[background-size] duration-700 ease-out group-hover:bg-[length:100%_1px] group-focus-visible:bg-[length:100%_1px]"
              >
                {EMAIL_USER}
              </span>
            </span>
            <span className={MASK}>
              <span data-contact-drop className="block">
                <span className="text-accent-ink">@</span>
                <span className="text-fg-muted transition-colors duration-500 group-hover:text-fg">{EMAIL_DOMAIN}</span>
              </span>
            </span>
          </a>

          <div data-contact-item data-reveal className="mt-[clamp(1rem,2.6svh,1.75rem)]">
            <CopyEmail email={site.email} />
          </div>

          <ul
            data-contact-item
            data-reveal
            className="mt-[clamp(0.5rem,1.4svh,1rem)] flex flex-wrap items-center gap-x-6 gap-y-1 text-[0.9375rem]"
          >
            {LINKS.map(({ label, href, mark, note }) => (
              <li key={label}>
                <a href={href} target="_blank" rel="noopener noreferrer" className="group inline-flex min-h-11 items-center gap-2">
                  <ChannelMark name={mark} className={MARK} />
                  <span className={DRAW}>{label}</span>
                  <span aria-hidden className={`${ARROW} group-hover:translate-x-0.5 group-hover:-translate-y-0.5`}>
                    ↗
                  </span>
                  <span className="sr-only">{note}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* Its height follows the screen's (max-w in svh), so the section fits one screen from tablets up. */}
        <LivedInGlobe className="col-span-10 sm:col-span-6 md:col-span-5 md:col-start-1 md:row-span-2 md:row-start-2 md:max-w-[50svh]" />

        <div
          data-contact-item
          data-reveal
          className="col-span-12 md:col-span-7 md:col-start-6 md:row-start-3 md:self-start"
        >
          <p className="eyebrow flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-line pt-[clamp(0.875rem,2.2svh,1.5rem)] text-fg-muted">
            <span>{`Based in ${site.location.city}, ${site.location.region}, ${site.location.country}`}</span>
            <span className="text-fg">{`Open to ${site.openTo.toLowerCase()}`}</span>
          </p>
        </div>
      </div>
    </section>
  );
}
