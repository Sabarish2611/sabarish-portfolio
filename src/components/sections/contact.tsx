"use client";

import { useRef, type ReactNode } from "react";
import boatRail from "@/assets/photos/boat-rail.jpg";
import { CopyEmail } from "@/components/ui/copy-email";
import { DecodeText } from "@/components/ui/decode-text";
import { RevealImage } from "@/components/ui/reveal-image";
import { RevealText } from "@/components/ui/reveal-text";
import { site } from "@/content/site";
import { useLocalTime } from "@/hooks/use-local-time";
import { DURATION, EASE, gsap, settlePendingTriggers, useGSAP } from "@/lib/gsap";

const MAILTO = `mailto:${site.email}`;
// The address is long: narrow columns break it before the "@" rather than overflow.
const [EMAIL_USER, EMAIL_DOMAIN] = site.email.split("@");
/** "linkedin.com/in/sabarish2611": the profile URL without its scheme, "www." or trailing slash. */
const LINKEDIN_LABEL = site.links.linkedin.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");

const LINK = "link-draw bg-origin-content py-[max(0px,calc((2.75rem_-_1lh)/2))]";

/**
 * One label/value row. The hairline above it is a ::before scaled by --rule (the last row's ::after
 * closes the list), so the entrance can draw them without extra elements: a <dl> row may hold only
 * its dt and dd. The row starts hidden (data-reveal) until the entrance has set its lines to zero.
 */
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      data-contact-row
      data-reveal
      className="relative grid gap-1.5 py-[clamp(0.875rem,2svh,1.25rem)] [--rule:1] before:absolute before:inset-x-0 before:top-0 before:h-px before:origin-left before:scale-x-(--rule) before:bg-line last:after:absolute last:after:inset-x-0 last:after:bottom-0 last:after:h-px last:after:origin-left last:after:scale-x-(--rule) last:after:bg-line lg:grid-cols-[8.5rem_1fr] lg:items-center lg:gap-6"
    >
      <dt data-contact-item data-reveal className="eyebrow text-fg-muted">
        {label}
      </dt>
      <dd data-contact-item data-reveal className="flex min-h-11 min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
        {children}
      </dd>
    </div>
  );
}

/**
 * (05) Contact — the finale. The off-the-clock photo, its gaze leading into the details: a short
 * heading, then every way to get in touch as label/value rows (email with a copy button, LinkedIn, the
 * résumé, where Sabarish is based, the local time there). From tablets up it fits one screen like About.
 */
export function Contact() {
  const root = useRef<HTMLElement>(null);
  const time = useLocalTime(site.location.timeZone);

  useGSAP(
    () => {
      const section = root.current;
      if (!section) return;
      const rows = gsap.utils.toArray<HTMLElement>("[data-contact-row]", section);
      const items = gsap.utils.toArray<HTMLElement>("[data-contact-item]", section);
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set([...rows, ...items], { autoAlpha: 1 });
      });

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        if (!rows.length) return;
        // The hairlines draw in one after another, each row's label and value rising in behind its line.
        settlePendingTriggers();
        gsap
          .timeline({ scrollTrigger: { trigger: rows[0], start: "top 90%", once: true } })
          .fromTo(rows, { "--rule": 0 }, { "--rule": 1, duration: DURATION.slow, ease: EASE.inOut, stagger: 0.08 }, 0)
          .fromTo(
            items,
            { autoAlpha: 0, y: 10 },
            { autoAlpha: 1, y: 0, duration: DURATION.base, ease: EASE.out, stagger: 0.04 },
            0.2,
          );
        // The fromTo above has already zeroed the lines, so the rows can show without a flash of
        // fully drawn lines (a /#contact link lands here before the entrance starts).
        gsap.set(rows, { autoAlpha: 1 });
      });
    },
    { scope: root },
  );

  return (
    <section
      id="contact"
      ref={root}
      aria-labelledby="contact-title"
      className="section-pad md:flex md:min-h-[calc(100svh-var(--header-h))] md:flex-col md:justify-center md:py-[clamp(1rem,3svh,2.5rem)]"
    >
      <div className="container-page grid grid-cols-12 gap-x-3 gap-y-10 sm:gap-x-6 md:gap-y-[clamp(1.25rem,4svh,3rem)]">
        <p className="eyebrow col-span-12 flex items-center gap-3 text-fg-muted">
          <span className="text-accent-ink">(05)</span>
          <span aria-hidden className="h-px w-8 bg-line-strong" />
          <DecodeText>Contact</DecodeText>
        </p>

        {/* Its height follows the screen's (max-w in svh), so the section fits one screen from tablets up. */}
        <RevealImage
          src={boatRail}
          alt={`${site.name} leaning on a boat's rail, looking out over the water`}
          // RevealImage draws the photo 1.16x the card's width (its drift overscan).
          sizes="(min-width: 1600px) 600px, (min-width: 768px) 42vw, (min-width: 640px) 68vw, 98vw"
          className="col-span-10 aspect-3/4 w-full [--cut:1rem] [--grain:0.12] sm:col-span-7 md:col-span-5 md:row-start-2 md:max-w-[48svh] lg:[--cut:1.5rem]"
        />

        <div className="col-span-12 flex flex-col gap-[clamp(2rem,5svh,3.5rem)] md:col-span-7 md:col-start-6 md:row-start-2 md:justify-between">
          <RevealText
            as="h2"
            id="contact-title"
            className="font-serif text-[length:clamp(2.75rem,min(6vw,8svh),6.5rem)] leading-[0.92] tracking-[-0.03em]"
          >
            {"Let’s "}
            <span data-hl className="hl italic">
              talk.
            </span>
          </RevealText>

          <dl>
            <Row label="Email">
              {/* The label keeps the accessible name exact: Chrome reads the <wbr> as a space. */}
              <a
                href={MAILTO}
                aria-label={site.email}
                className={`${LINK} min-w-0 font-sans text-[length:clamp(1.25rem,1.9vw,1.75rem)] leading-tight tracking-[-0.02em]`}
              >
                {EMAIL_USER}
                <wbr />@{EMAIL_DOMAIN}
              </a>
              <CopyEmail email={site.email} />
            </Row>
            <Row label="LinkedIn">
              <a
                href={site.links.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-2 text-[length:clamp(1rem,1.3vw,1.1875rem)]"
              >
                <span className={LINK}>{LINKEDIN_LABEL}</span>
                <span
                  aria-hidden
                  className="text-fg-muted transition-[translate,color] duration-500 ease-out group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-accent-ink"
                >
                  ↗
                </span>
                <span className="sr-only">(opens in new tab)</span>
              </a>
            </Row>
            <Row label="Résumé">
              <a
                href={site.links.resume}
                download
                className="group inline-flex items-center gap-2 text-[length:clamp(1rem,1.3vw,1.1875rem)]"
              >
                <span className={LINK}>Download PDF</span>
                <span
                  aria-hidden
                  className="text-fg-muted transition-[translate,color] duration-500 ease-out group-hover:translate-y-0.5 group-hover:text-accent-ink"
                >
                  ↓
                </span>
                <span className="sr-only"> (résumé)</span>
              </a>
            </Row>
            <Row label="Based in">
              <span className="text-[length:clamp(1rem,1.3vw,1.1875rem)]">
                {`${site.location.city}, ${site.location.region}, ${site.location.country}`}
              </span>
              <span className="text-[0.9375rem] text-fg-muted">{`Open to ${site.openTo.toLowerCase()}`}</span>
            </Row>
            <Row label="Local time">
              <span data-qa-mask className="inline-flex items-center gap-2.5 text-[length:clamp(1rem,1.3vw,1.1875rem)]">
                <span aria-hidden className="size-1.5 rounded-full bg-accent-ink" />
                <span>
                  <time suppressHydrationWarning>{time ?? "--:--"}</time>
                  {` ${site.location.timeZoneLabel}`}
                </span>
              </span>
              <span className="text-[0.9375rem] text-fg-muted">{site.location.utcOffset}</span>
            </Row>
          </dl>
        </div>
      </div>
    </section>
  );
}
