"use client";

import { useRef } from "react";
import boatRail from "@/assets/photos/boat-rail.jpg";
import { ContactClocks } from "@/components/contact/contact-clocks";
import { CopyEmail } from "@/components/ui/copy-email";
import { DecodeText } from "@/components/ui/decode-text";
import { RevealImage } from "@/components/ui/reveal-image";
import { RevealText } from "@/components/ui/reveal-text";
import { site } from "@/content/site";
import { DURATION, EASE, gsap, settlePendingTriggers, useGSAP } from "@/lib/gsap";

const MAILTO = `mailto:${site.email}`;
/** The address is long: the headline sets it on two lines, the name over "@domain". */
const [EMAIL_USER, EMAIL_DOMAIN] = site.email.split("@");
/** A line of the address, masked so it can drop in from under the line above it (room for descenders). */
const MASK = "block overflow-hidden pb-[0.14em] -mb-[0.14em]";

/**
 * (05) Contact — the finale. The address is the headline: it hangs from a line under "Let's talk.",
 * with a send button and Copy beside it, then LinkedIn and the résumé. The off-the-clock photo sits on
 * the left from tablets up (after the address in reading order, so phones and screen readers get the
 * heading first); under the actions, where Sabarish is based and the time there, with two clocks for a
 * visitor on another clock (contact/contact-clocks.tsx). Entrance: the line draws out, the address
 * drops in from under it, the rest rises in behind. Fits one screen from tablets up.
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
          gsap
            .timeline({ scrollTrigger: { trigger: line, start: "top 85%", once: true } })
            .fromTo(line, { scaleX: 0 }, { scaleX: 1, duration: DURATION.slow, ease: EASE.inOut }, 0)
            .fromTo(drops, { yPercent: -120 }, { yPercent: 0, duration: DURATION.base, ease: EASE.out, stagger: 0.09 }, 0.35)
            .fromTo(
              items,
              { autoAlpha: 0, y: 12 },
              { autoAlpha: 1, y: 0, duration: DURATION.base, ease: EASE.out, stagger: 0.08 },
              0.6,
            );
          // The fromTos above have set their start states, so the line and the address can show without
          // a flash of their finished look (a /#contact link lands here before the entrance starts).
          gsap.set([line, address], { autoAlpha: 1 });
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

          {/* The address is the headline. Keyboard focus skips it: the send button right after it opens
              the same email, so one tab stop does the job. */}
          <a
            data-contact-address
            data-reveal
            href={MAILTO}
            tabIndex={-1}
            className="group mt-[clamp(0.5rem,1.4svh,1rem)] block w-fit font-serif text-[length:clamp(2.125rem,9.4vw,3.5rem)] leading-[0.95] tracking-[-0.025em] md:text-[length:min(5.2vw,9svh)]"
          >
            <span className={MASK}>
              <span
                data-contact-drop
                className="block bg-[linear-gradient(currentColor,currentColor)] bg-[length:0%_1px] bg-[position:0_100%] bg-no-repeat transition-[background-size] duration-700 ease-out group-hover:bg-[length:100%_1px]"
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

          <div
            data-contact-item
            data-reveal
            className="mt-[clamp(1rem,2.6svh,1.75rem)] flex flex-wrap items-center gap-x-3 gap-y-4"
          >
            <a
              href={MAILTO}
              className="group inline-flex h-12 chamfer-fill items-center gap-3 px-6 font-medium text-on-accent [--cut:0.625rem]"
            >
              Write an email
              <span aria-hidden className="transition-transform duration-500 ease-out group-hover:translate-x-0.5">
                →
              </span>
            </a>
            <CopyEmail email={site.email} />
            <span aria-hidden className="mx-2 hidden h-5 w-px bg-line-strong lg:block" />
            <span className="flex basis-full items-center gap-x-6 lg:basis-auto lg:gap-x-5">
              <a
                href={site.links.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex min-h-11 items-center gap-1.5 text-[0.9375rem]"
              >
                <span className="link-draw">LinkedIn</span>
                <span
                  aria-hidden
                  className="text-fg-muted transition-[translate,color] duration-500 ease-out group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-accent-ink"
                >
                  ↗
                </span>
                <span className="sr-only">(opens in new tab)</span>
              </a>
              <a href={site.links.resume} download className="group inline-flex min-h-11 items-center gap-1.5 text-[0.9375rem]">
                <span className="link-draw">Résumé</span>
                <span className="sr-only">(PDF)</span>
                <span
                  aria-hidden
                  className="text-fg-muted transition-[translate,color] duration-500 ease-out group-hover:translate-y-0.5 group-hover:text-accent-ink"
                >
                  ↓
                </span>
              </a>
            </span>
          </div>
        </div>

        {/* Its height follows the screen's (max-w in svh), so the section fits one screen from tablets up.
            RevealImage draws the photo 1.16x the card's width (its drift overscan). */}
        <RevealImage
          src={boatRail}
          alt={`${site.name} leaning on a boat's rail, looking out over the water`}
          sizes="(min-width: 1600px) 640px, (min-width: 768px) 42vw, (min-width: 640px) 60vw, 98vw"
          className="col-span-10 aspect-3/4 w-full [--cut:1rem] [--grain:0.12] sm:col-span-6 md:col-span-5 md:col-start-1 md:row-span-2 md:row-start-2 md:max-w-[50svh] lg:[--cut:1.5rem]"
        />

        <div
          data-contact-item
          data-reveal
          className="col-span-12 md:col-span-7 md:col-start-6 md:row-start-3 md:self-start"
        >
          <ContactClocks />
        </div>
      </div>
    </section>
  );
}
